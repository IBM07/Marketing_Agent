import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Groq } from "groq-sdk";
import { rateLimiter } from "@/lib/rate-limit";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, RateLimitError, ValidationError, AppError } from "@/lib/errors";

const GenerateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000, "Prompt must be less than 2000 characters"),
  goal: z.enum(["Lead Gen", "Brand Awareness", "Product Launch"]).optional().default("Lead Gen"),
  productName: z.string().optional().default("Your Product"),
  model: z.string().optional().default("llama-3.3-70b-versatile"),
});

// Simple in-memory cache for 5-minute TTL
const promptCache = new Map<string, { result: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getSystemPrompt(goal: string, productName: string) {
  const basePrompt = `You are the world's highest-paid, most precise copywriter and behavioral psychologist. You write with the sharp, zero-fluff confidence of a visionary.

Your objective: Write an irresistible, pattern-interrupting cold email for "${productName}".

CORE PSYCHOLOGICAL TRIGGERS TO USE:
1. The "Open Loop" Subject Line: 2-4 words, ideally lowercase, brutally curious. NO title case. NO salesy words.
2. The "Punch in the Mouth" Opening: Shatter their current worldview immediately. No pleasantries. No "Hope you're well."
3. The Value Asymmetry: Make the outcome sound massive while the effort sounds effortless.
4. The "Anti-Sales" CTA: A low-friction, almost casual ask that feels completely stripped of pressure.`;

  let goalSpecific = "";
  if (goal === "Lead Gen") {
    goalSpecific = "\nFocus on generating a direct reply or booking a quick meeting. Emphasize their pain point and your unique solution.";
  } else if (goal === "Brand Awareness") {
    goalSpecific = "\nFocus on making them remember you. Provide massive upfront value without asking for anything in return right away.";
  } else if (goal === "Product Launch") {
    goalSpecific = "\nFocus on exclusivity and urgency. Make them feel like they are getting early access to something game-changing.";
  }

  const constraints = `
STRICT CONSTRAINTS:
- ABSOLUTE MAXIMUM 50 words for the body. Shorter is deadlier.
- Tone: Blunt, visionary, radically transparent, slightly futuristic.
- FORMAT: Return valid strictly formatted JSON with exactly two distinct keys "subject" and "body".

Example JSON format:
{
  "subject": "quick question",
  "body": "Building without the right tools is slow. ${productName} gives you the leverage you need to ship faster. Worth a 2-min peek?"
}`;

  return basePrompt + goalSpecific + "\n" + constraints;
}

export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }

  const rateLimit = rateLimiter.check(userId, 10, 60000); // 10 requests/minute as per spec
  if (!rateLimit.success) {
    throw new RateLimitError();
  }

  const body = await req.json();
  const validation = GenerateSchema.safeParse(body);

  if (!validation.success) {
    throw new ValidationError("Validation failed", "VALIDATION_ERROR");
  }

  const { prompt, goal, productName, model } = validation.data;

  // Check Cache
  const cacheKey = `${goal}:${productName}:${prompt}:${model}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result);
  }

  const systemPrompt = getSystemPrompt(goal, productName);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30s timeout

  let completion;
  let usedModel = model;

  try {
    completion = await groq.chat.completions.create(
      {
        model: usedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Product/Niche Details:\n${prompt}` },
        ],
        response_format: { type: "json_object" },
        temperature: 1,
        max_tokens: 1024,
      },
      { signal: abortController.signal }
    );
  } catch (error: unknown) {
    // If primary model fails or times out, try fallback
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[AI_GENERATE] Primary model ${model} failed, trying fallback. Error:`, errorMessage);
    usedModel = "llama3-8b-8192";
    
    const fallbackController = new AbortController();
    const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 30000);
    
    try {
      completion = await groq.chat.completions.create(
        {
          model: usedModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Product/Niche Details:\n${prompt}` },
          ],
          response_format: { type: "json_object" },
          temperature: 1,
          max_tokens: 1024,
        },
        { signal: fallbackController.signal }
      );
    } catch {
      clearTimeout(fallbackTimeoutId);
      throw new AppError(502, "Failed to generate content from Groq after fallback", "AI_PROVIDER_ERROR");
    } finally {
      clearTimeout(fallbackTimeoutId);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AppError(502, "Empty response from Groq", "AI_PROVIDER_ERROR");
  }

  let resultObj;
  try {
    resultObj = JSON.parse(content);
  } catch {
    throw new AppError(502, "Invalid JSON response from AI", "AI_PARSE_ERROR");
  }

  // Update Cache
  promptCache.set(cacheKey, { result: resultObj, timestamp: Date.now() });

  return NextResponse.json(resultObj);
});

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Groq } from "groq-sdk";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { prompt, model = "llama-3.3-70b-versatile" } = await req.json();

    if (!prompt) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    const systemPrompt = `You are the world's highest-paid, most precise copywriter and behavioral psychologist, specializing in hyper-converting cold emails. You write with the sharp, zero-fluff confidence of a visionary offering a golden ticket.

Your objective: Write an irresistible, pattern-interrupting cold email for "The Builder’s Arsenal" — a premium SaaS platform turning non-technical people into engineering powerhouses via vibe coding, AI agents, and production-ready systems. 

Building a high-quality product no longer requires a massive engineering team or backend complexity.

CORE PSYCHOLOGICAL TRIGGERS TO USE:
1. The "Open Loop" Subject Line: 2-4 words, ideally lowercase, brutally curious (e.g., "skipping the engineering team", "building without code"). NO title case. NO salesy words.
2. The "Punch in the Mouth" Opening: Shatter their current worldview immediately. No pleasantries. No "Hope you're well."
3. The Value Asymmetry: Make the outcome (shipping production-ready SaaS) sound massive while the effort (using The Builder's Arsenal tools/academy) sounds effortless. Mention features organically: AI-Powered Toolkit (MVP/Architecture), The Builder’s Academy (learning Cursor/Windsurf), Production-Ready Frameworks (Day 1 scale).
4. The "Anti-Sales" CTA: A low-friction, almost casual ask that feels completely stripped of pressure.

STRICT CONSTRAINTS:
- ABSOLUTE MAXIMUM 50 words for the body. Shorter is deadlier.
- Tone: Blunt, visionary, radically transparent, slightly futuristic.
- Link insertion: "https://the-builders-arsenal.vercel.app/" MUST appear naturally.
- FORMAT: Return valid strictly formatted JSON with exactly two distinct keys "subject" and "body".

Example JSON format:
{
  "subject": "skip the eng team",
  "body": "Building without code isn't a toy anymore. The Builder's Arsenal gives you production-ready frameworks, AI agent planning, and deep Cursor mastery to ship real SaaS on Day 1. Leave the backend complexity behind. https://the-builders-arsenal.vercel.app/ Worth a 2-min peek?"
}`;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Product/Niche Details:\n${prompt}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 1,
      max_tokens: 1024,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error("[AI_GENERATE_POST] Empty response from Groq");
      return new NextResponse("Failed to generate content from Groq", { status: 502 });
    }

    let resultObj;
    try {
      resultObj = JSON.parse(content);
    } catch (parseError) {
      console.error("[AI_GENERATE_POST] JSON parse error:", parseError);
      return new NextResponse("Invalid JSON response from AI", { status: 502 });
    }

    return NextResponse.json(resultObj);
  } catch (error: unknown) {
    console.error("[AI_GENERATE_POST]", error);
    
    if (error instanceof Error) {
      if (error.message.includes("401") || error.message.includes("authentication")) {
        return new NextResponse("Invalid or missing Groq API key", { status: 401 });
      }
      if (error.message.includes("rate_limit")) {
        return new NextResponse("Groq API rate limit exceeded", { status: 429 });
      }
    }
    
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

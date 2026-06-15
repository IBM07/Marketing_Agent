import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger";

export interface Contact {
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

export interface LeadExtractionPayload {
  contacts: Contact[];
  companyName: string;
  summary: string;
}

export class KeyRotationLLMClient {
  private cerebrasKeys: string[] = [];
  private groqKeys: string[] = [];
  private geminiKeys: string[] = [];

  constructor() {
    // Cerebras — primary provider (1M tokens/day free tier)
    this.cerebrasKeys = process.env.CEREBRAS_API_KEYS
      ? process.env.CEREBRAS_API_KEYS.split(",").map(k => k.trim()).filter(Boolean)
      : [];
    if (this.cerebrasKeys.length === 0 && process.env.CEREBRAS_API_KEY) {
      this.cerebrasKeys = [process.env.CEREBRAS_API_KEY.trim()];
    }

    // Groq — secondary fallback
    this.groqKeys = process.env.GROQ_API_KEYS
      ? process.env.GROQ_API_KEYS.split(",").map(k => k.trim()).filter(Boolean)
      : [];
    if (this.groqKeys.length === 0 && process.env.GROQ_API_KEY) {
      this.groqKeys = [process.env.GROQ_API_KEY.trim()];
    }

    // Gemini — final fallback
    this.geminiKeys = process.env.GEMINI_API_KEYS
      ? process.env.GEMINI_API_KEYS.split(",").map(k => k.trim()).filter(Boolean)
      : [];
    if (this.geminiKeys.length === 0 && process.env.GEMINI_API_KEY) {
      this.geminiKeys = [process.env.GEMINI_API_KEY.trim()];
    }
  }

  private getRandomKey(keys: string[], excludeList: Set<string>): string {
    const availableKeys = keys.filter(k => !excludeList.has(k));
    if (availableKeys.length === 0) return "";
    const index = Math.floor(Math.random() * availableKeys.length);
    return availableKeys[index];
  }

  async extractWithCerebras(
    prompt: string,
    content: string,
    userCustomKey?: string
  ): Promise<LeadExtractionPayload | null> {
    const keysToUse = userCustomKey ? [userCustomKey.trim()] : [...this.cerebrasKeys];
    if (keysToUse.length === 0) {
      logger.warn("[AI_ROTATION] No Cerebras keys configured — skipping.");
      return null;
    }

    const exhaustedKeys = new Set<string>();
    let retries = 0;
    const maxRetries = Math.min(keysToUse.length, 3);

    while (retries < maxRetries) {
      const activeKey = this.getRandomKey(keysToUse, exhaustedKeys);
      if (!activeKey) break;

      try {
        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-oss-120b",
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: content },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        });

        if (response.status === 429) {
          logger.warn(`[AI_ROTATION] Cerebras key rate limited (429). Rotating key...`);
          exhaustedKeys.add(activeKey);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Cerebras HTTP error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const extracted = JSON.parse(data.choices[0].message.content);
        logger.info("[AI_ROTATION] Cerebras extraction successful.");
        return extracted as LeadExtractionPayload;
      } catch (err) {
        logger.warn(`[AI_ROTATION] Cerebras key failure: ${err instanceof Error ? err.message : String(err)}. Retrying failover...`);
        exhaustedKeys.add(activeKey);
        retries++;
      }
    }

    return null;
  }

  async extractWithGroq(
    prompt: string, 
    content: string, 
    userCustomKey?: string
  ): Promise<LeadExtractionPayload | null> {
    const keysToUse = userCustomKey ? [userCustomKey.trim()] : [...this.groqKeys];
    if (keysToUse.length === 0) {
      logger.warn("[AI_ROTATION] No operational Groq keys located.");
      return null;
    }

    const exhaustedKeys = new Set<string>();
    let retries = 0;
    const maxRetries = Math.min(keysToUse.length, 3);

    while (retries < maxRetries) {
      const activeKey = this.getRandomKey(keysToUse, exhaustedKeys);
      if (!activeKey) break;

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: content },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        });

        if (response.status === 429) {
          logger.warn(`[AI_ROTATION] Groq key rate limited (429). Rotating key...`);
          exhaustedKeys.add(activeKey);
          retries++;
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Groq HTTP error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const extracted = JSON.parse(data.choices[0].message.content);
        logger.info("[AI_ROTATION] Groq extraction successful.");
        return extracted as LeadExtractionPayload;
      } catch (err) {
        logger.warn(`[AI_ROTATION] Groq key failure: ${err instanceof Error ? err.message : String(err)}. Retrying failover...`);
        exhaustedKeys.add(activeKey);
        retries++;
      }
    }

    return null;
  }

  // Task 2.3: Return type changed from Promise<LeadExtractionPayload> to Promise<LeadExtractionPayload | null>.
  // All three providers now share the same null-return contract on exhaustion.
  // Callers no longer need asymmetric try/catch just for Gemini.
  async extractWithGemini(
    prompt: string, 
    content: string, 
    userCustomKey?: string
  ): Promise<LeadExtractionPayload | null> {
    const keysToUse = userCustomKey ? [userCustomKey.trim()] : [...this.geminiKeys];
    if (keysToUse.length === 0) {
      logger.warn("[AI_ROTATION] No Gemini keys configured — skipping.");
      return null;
    }

    const exhaustedKeys = new Set<string>();
    let retries = 0;
    const maxRetries = Math.min(keysToUse.length, 3);

    while (retries < maxRetries) {
      const activeKey = this.getRandomKey(keysToUse, exhaustedKeys);
      if (!activeKey) break;

      try {
        const ai = new GoogleGenAI({ apiKey: activeKey });
        
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: `${prompt}\n\nSource Scrap Target:\n${content}`,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        if (!response.text) {
          throw new Error("Empty text returned from Gemini API");
        }

        const extracted = JSON.parse(response.text);
        logger.info("[AI_ROTATION] Gemini extraction successful.");
        return extracted as LeadExtractionPayload;
      } catch (err) {
        logger.warn(`[AI_ROTATION] Gemini key failure: ${err instanceof Error ? err.message : String(err)}. Rotating key...`);
        exhaustedKeys.add(activeKey);
        retries++;
      }
    }

    // Task 2.3: Return null instead of throwing so callers use uniform null-guards.
    logger.warn("[AI_ROTATION] Gemini fallback pool exhausted — returning null.");
    return null;
  }
}

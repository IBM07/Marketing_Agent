import { KeyRotationLLMClient } from "../ai/rotation-client";
import { logger } from "../logger";

const llmClient = new KeyRotationLLMClient();

export interface AgentPlan {
  searchQueries: string[];
  targetCriteria: string;
}

/**
 * The orchestrator translates a natural language prompt into a structured scraping plan.
 * Generates 3–5 diverse search queries optimized for direct business websites,
 * with built-in aggregator exclusions to maximize real lead yield.
 */
export async function createAgentPlan(prompt: string): Promise<AgentPlan> {
  const systemPrompt = `
    You are an expert AI Marketing Agent Orchestrator.
    Your job is to translate a user's natural language request for leads into a structured execution plan.

    CRITICAL RULES:
    - Generate 10 to 15 diverse, NATURAL search queries that will surface direct business websites.
    - Write queries EXACTLY as a human would type them into Google. Do NOT use any of the following:
      * Quote operators like "contact us", "about us", "hire me", "email", "@", "@gmail.com"
      * Dorking terms: email, phone, contact, "@", hire me, get in touch, reach us
      * Site TLD filters like site:.pk, site:.ae, site:.in, site:.us
      * Any operator that makes the query look like an automated scraping attempt
    - These terms cause a "400 Bad Request" from the search API. Our scraper will extract emails directly from the pages.
    - Focus query diversity on: industry + location, specific company type variations, regional synonyms, and professional title searches.
    - The targetCriteria must be specific: name the exact data points to extract (email, phone, company name, role/title of the contact).

    Output exactly in this JSON format:
    {
      "searchQueries": ["query1", "query2", "query3", "query4"],
      "targetCriteria": "Extract email addresses, phone numbers, company name, and owner/founder name."
    }

    Example Input: "Find me emails of digital marketing agencies in Karachi Pakistan"
    Example Output:
    {
      "searchQueries": [
        "digital marketing agency Karachi",
        "digital marketing company Karachi Pakistan",
        "social media marketing firm Karachi",
        "SEO agency Karachi Pakistan"
      ],
      "targetCriteria": "Extract email addresses, phone numbers, company name, and founder/owner/manager name for digital marketing agencies in Karachi."
    }

    Example Input: "freelancers in lahore who do web development"
    Example Output:
    {
      "searchQueries": [
        "web developer freelancer Lahore",
        "freelance web development Lahore Pakistan",
        "web designer Lahore portfolio",
        "frontend developer Lahore hire"
      ],
      "targetCriteria": "Extract email addresses, phone numbers, freelancer name, and role/title."
    }
  `;

  try {
    // Primary: Cerebras (1M tokens/day free tier, fastest)
    const cerebrasResult = await llmClient.extractWithCerebras(systemPrompt, prompt);
    if (cerebrasResult) {
      const plan = (cerebrasResult as unknown) as AgentPlan;
      if (plan.searchQueries && plan.searchQueries.length > 0) {
        logger.info("[AGENT_ORCHESTRATOR] Plan created via Cerebras.");
        return plan;
      }
    }

    // Secondary fallback: Groq
    logger.warn("[AGENT_ORCHESTRATOR] Cerebras unavailable or empty — falling back to Groq.");
    const groqResult = await llmClient.extractWithGroq(systemPrompt, prompt);
    if (groqResult) {
      const plan = (groqResult as unknown) as AgentPlan;
      if (!plan.searchQueries || plan.searchQueries.length === 0) {
        throw new Error("Groq returned an empty searchQueries array.");
      }
      logger.info("[AGENT_ORCHESTRATOR] Plan created via Groq.");
      return plan;
    }

    // Final fallback: Gemini
    logger.warn("[AGENT_ORCHESTRATOR] Groq unavailable — falling back to Gemini.");
    const geminiResult = await llmClient.extractWithGemini(systemPrompt, prompt);
    const fallbackPlan = (geminiResult as unknown) as AgentPlan;
    if (!fallbackPlan.searchQueries || fallbackPlan.searchQueries.length === 0) {
      throw new Error("Gemini fallback returned an empty searchQueries array.");
    }
    logger.info("[AGENT_ORCHESTRATOR] Plan created via Gemini.");
    return fallbackPlan;
  } catch (error: unknown) {
    logger.error("[AGENT_ORCHESTRATOR_ERROR]", error);
    throw new Error("Failed to orchestrate agent plan.");
  }
}

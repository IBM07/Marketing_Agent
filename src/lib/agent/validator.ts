import { KeyRotationLLMClient } from "../ai/rotation-client";
import { logger } from "../logger";

const llmClient = new KeyRotationLLMClient();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  field: string;
  /** Whether the field check passed */
  value: boolean;
  /** Exact verbatim quote from the source that justifies the decision */
  citation: string;
  /** URL the citation was pulled from */
  source: string;
  /** Confidence score: 0.0 – 1.0 */
  confidence: number;
}

export interface AgentVote {
  agentId: "criteria" | "intent" | "quality";
  passed: boolean;
  citations: ValidationResult[];
}

export interface ValidationDecision {
  /** true only when criteria + quality agents pass (intent is a scoring bonus) */
  approved: boolean;
  votes: AgentVote[];
  finalScore: number;
  /** true when ALL AI providers were exhausted — do NOT treat as rejection */
  crashed: boolean;
}

// ---------------------------------------------------------------------------
// Citation anti-hallucination guard
// ---------------------------------------------------------------------------

/**
 * Returns true only when the citation string is literally present inside
 * sourceText (case-insensitive).  Empty or whitespace-only citations always
 * return false — an agent that has no evidence must not claim a pass.
 */
export function verifyCitation(
  citation: string,
  sourceText: string
): boolean {
  if (!citation || citation.trim().length === 0) return false;
  return sourceText.toLowerCase().includes(citation.toLowerCase().trim());
}

// ---------------------------------------------------------------------------
// Internal: call any LLM provider with a structured JSON prompt
// ---------------------------------------------------------------------------

interface AgentRawResponse {
  passed: boolean;
  citations: ValidationResult[];
}

async function callValidationAgent(
  systemPrompt: string,
  userContent: string
): Promise<AgentRawResponse | null> {
  // Cerebras → Groq → Gemini cascade (same pattern as orchestrator.ts)
  const cerebrasResult = await llmClient.extractWithCerebras(
    systemPrompt,
    userContent
  );
  if (cerebrasResult) {
    return cerebrasResult as unknown as AgentRawResponse;
  }

  logger.warn(
    "[VALIDATOR] Cerebras unavailable — falling back to Groq."
  );
  const groqResult = await llmClient.extractWithGroq(systemPrompt, userContent);
  if (groqResult) {
    return groqResult as unknown as AgentRawResponse;
  }

  logger.warn("[VALIDATOR] Groq unavailable — falling back to Gemini.");
  const geminiResult = await llmClient.extractWithGemini(
    systemPrompt,
    userContent
  );
  return geminiResult as unknown as AgentRawResponse;
}

// ---------------------------------------------------------------------------
// Agent 1 — Criteria Validator
// "Does this company match the user's stated criteria?"
// ---------------------------------------------------------------------------

async function runCriteriaAgent(
  sourceText: string,
  sourceUrl: string,
  userCriteria: string
): Promise<AgentVote> {
  const systemPrompt = `
You are Agent 1: the Criteria Validator.
Your sole job: determine whether the company described in the source text matches the user's stated criteria.

USER CRITERIA: "${userCriteria}"

RULES:
- For every claim you make, you MUST provide an EXACT verbatim quote from the source text.
- If you cannot find a supporting quote in the source text, you MUST set "value": false for that field.
- Do NOT paraphrase. Copy the text exactly, character-for-character.
- Set "passed": true only if the company clearly satisfies the criteria with citation evidence.

Respond ONLY in this exact JSON schema (no markdown):
{
  "passed": true | false,
  "citations": [
    {
      "field": "descriptive field name (e.g., 'industry match', 'location match')",
      "value": true | false,
      "citation": "EXACT verbatim quote from source text (empty string if none found)",
      "source": "${sourceUrl}",
      "confidence": 0.0 to 1.0
    }
  ]
}
`;

  const userContent = `SOURCE URL: ${sourceUrl}\n\nSOURCE TEXT:\n${sourceText}`;

  const raw = await callValidationAgent(systemPrompt, userContent);

  if (!raw || typeof raw.passed !== "boolean") {
    logger.warn("[VALIDATOR] Criteria agent returned invalid payload — defaulting to fail.");
    return { agentId: "criteria", passed: false, citations: [] };
  }

  // Anti-hallucination pass: verify each citation is literally in the source
  const verifiedCitations: ValidationResult[] = (raw.citations || []).map(
    (c) => {
      if (c.value && !verifyCitation(c.citation, sourceText)) {
        logger.warn(
          `[VALIDATOR] Criteria hallucination detected for field "${c.field}" — forcing value: false`
        );
        return { ...c, value: false, confidence: 0 };
      }
      return c;
    }
  );

  // Re-derive passed after citation verification
  const passed =
    verifiedCitations.length > 0 &&
    verifiedCitations.some((c) => c.value === true);

  return { agentId: "criteria", passed, citations: verifiedCitations };
}

// ---------------------------------------------------------------------------
// Agent 2 — Intent Validator
// "Are there buying signals? (hiring, funding, product launch)"
// ---------------------------------------------------------------------------

async function runIntentAgent(
  sourceText: string,
  sourceUrl: string
): Promise<AgentVote> {
  const systemPrompt = `
You are Agent 2: the Intent Validator.
Your job: detect buying signals in the source text that indicate the company is active and potentially receptive to outreach.

Buying signals include (but are not limited to):
- Active hiring / open job listings
- Recent funding round announcements
- New product or service launch
- Expansion into new market / geography
- Partnership announcements
- Conference / event participation

RULES:
- For EVERY signal you claim exists, you MUST provide an EXACT verbatim quote.
- If no verbatim quote can be found, set "value": false for that field.
- Set "passed": true if at least ONE buying signal has a verified citation.

Respond ONLY in this JSON schema (no markdown):
{
  "passed": true | false,
  "citations": [
    {
      "field": "signal type (e.g., 'hiring signal', 'funding signal')",
      "value": true | false,
      "citation": "EXACT verbatim quote or empty string",
      "source": "${sourceUrl}",
      "confidence": 0.0 to 1.0
    }
  ]
}
`;

  const userContent = `SOURCE URL: ${sourceUrl}\n\nSOURCE TEXT:\n${sourceText}`;

  const raw = await callValidationAgent(systemPrompt, userContent);

  if (!raw || typeof raw.passed !== "boolean") {
    logger.warn("[VALIDATOR] Intent agent returned invalid payload — defaulting to fail.");
    return { agentId: "intent", passed: false, citations: [] };
  }

  const verifiedCitations: ValidationResult[] = (raw.citations || []).map(
    (c) => {
      if (c.value && !verifyCitation(c.citation, sourceText)) {
        logger.warn(
          `[VALIDATOR] Intent hallucination detected for field "${c.field}" — forcing value: false`
        );
        return { ...c, value: false, confidence: 0 };
      }
      return c;
    }
  );

  const passed =
    verifiedCitations.length > 0 &&
    verifiedCitations.some((c) => c.value === true);

  return { agentId: "intent", passed, citations: verifiedCitations };
}

// ---------------------------------------------------------------------------
// Agent 3 — Quality Validator
// "Any red flags? (shutdown, acquired, zombie site)"
// ---------------------------------------------------------------------------

async function runQualityAgent(
  sourceText: string,
  sourceUrl: string
): Promise<AgentVote> {
  const systemPrompt = `
You are Agent 3: the Quality Validator.
Your job: identify red flags that indicate this is NOT a viable lead.

Red flags include (but are not limited to):
- Company appears to be shut down or bankrupt
- Website is a placeholder / parked domain
- Company was acquired and no longer operates independently
- "Zombie" website with no activity in 2+ years
- Site appears to be a scam, spam, or content farm
- No contact information whatsoever

RULES:
- For EVERY red flag you claim exists, you MUST provide an EXACT verbatim quote.
- If no verbatim quote supports the red flag, set "value": false for that field.
- Set "passed": true if NO red flags are found (i.e., the company appears healthy).
- Set "passed": false only when a verified red flag citation exists.

Respond ONLY in this JSON schema (no markdown):
{
  "passed": true | false,
  "citations": [
    {
      "field": "red flag type or 'no red flags found'",
      "value": true | false,
      "citation": "EXACT verbatim quote or empty string",
      "source": "${sourceUrl}",
      "confidence": 0.0 to 1.0
    }
  ]
}
`;

  const userContent = `SOURCE URL: ${sourceUrl}\n\nSOURCE TEXT:\n${sourceText}`;

  const raw = await callValidationAgent(systemPrompt, userContent);

  if (!raw || typeof raw.passed !== "boolean") {
    // Default quality agent to PASS on failure (don't block good leads on agent error)
    logger.warn("[VALIDATOR] Quality agent returned invalid payload — defaulting to pass.");
    return { agentId: "quality", passed: true, citations: [] };
  }

  const verifiedCitations: ValidationResult[] = (raw.citations || []).map(
    (c) => {
      // For quality agent: citations flag RED flags. value:true means a red flag IS present.
      // Hallucination check: if the agent claims a red flag (value:true) but quote not in source → force false
      if (c.value && !verifyCitation(c.citation, sourceText)) {
        logger.warn(
          `[VALIDATOR] Quality hallucination detected for field "${c.field}" — forcing value: false`
        );
        return { ...c, value: false, confidence: 0 };
      }
      return c;
    }
  );

  // Quality agent: passed = true means HEALTHY (no verified red flags)
  const hasVerifiedRedFlag = verifiedCitations.some((c) => c.value === true);
  const passed = !hasVerifiedRedFlag;

  return { agentId: "quality", passed, citations: verifiedCitations };
}

// ---------------------------------------------------------------------------
// Orchestrate all 3 agents and produce a final ValidationDecision
// ---------------------------------------------------------------------------

export async function validateLead(
  sourceText: string,
  sourceUrl: string,
  userCriteria: string
): Promise<ValidationDecision> {
  logger.info(`[VALIDATOR] Starting 3-agent validation for ${sourceUrl}`);

  // FIX 5: Run agents sequentially (not in parallel) to prevent 3× simultaneous
  // quota burn when all providers cascade to Gemini.
  const votes: AgentVote[] = [];

  const criteriaResult = await runCriteriaAgent(sourceText, sourceUrl, userCriteria)
    .catch(() => ({ agentId: "criteria" as const, passed: false, citations: [] }));
  votes.push(criteriaResult);

  const intentResult = await runIntentAgent(sourceText, sourceUrl)
    .catch(() => ({ agentId: "intent" as const, passed: false, citations: [] }));
  votes.push(intentResult);

  const qualityResult = await runQualityAgent(sourceText, sourceUrl)
    .catch((e) => {
      logger.error("[VALIDATOR] Quality agent threw:", e);
      return null;
    });
  if (qualityResult) votes.push(qualityResult);

  // FIX 6: Detect when all providers were exhausted vs genuine agent decisions
  const allAgentsCrashed = votes.length === 0;
  if (allAgentsCrashed) {
    logger.warn(`[VALIDATOR] All agents failed for ${sourceUrl} — skipping, not rejecting`);
    return { approved: false, votes: [], finalScore: 0, crashed: true };
  }

  // FIX 8: Criteria + Quality are hard gates; Intent is a scoring bonus only.
  // A valid company with a static homepage shouldn’t be rejected just because
  // it has no visible hiring/funding signals on that page.
  const criteriaVote = votes.find(v => v.agentId === "criteria");
  const qualityVote  = votes.find(v => v.agentId === "quality");
  const intentVote   = votes.find(v => v.agentId === "intent");

  const approved = !!criteriaVote?.passed && !!qualityVote?.passed;

  // Intent adds a bonus to the final score but doesn’t block approval
  const intentBonus = intentVote?.passed ? 0.15 : 0;
  const allCitations = votes.flatMap((v) => v.citations);
  const passingCitations = allCitations.filter((c) => c.value);
  const baseScore =
    passingCitations.length > 0
      ? passingCitations.reduce((sum, c) => sum + c.confidence, 0) / passingCitations.length
      : 0;
  const finalScore = Math.min(1.0, baseScore + intentBonus);

  logger.info(
    `[VALIDATOR] Decision for ${sourceUrl}: approved=${approved}, score=${finalScore.toFixed(2)}, votes=[${votes.map((v) => `${v.agentId}:${v.passed}`).join(", ")}]`
  );

  return { approved, votes, finalScore, crashed: false };
}

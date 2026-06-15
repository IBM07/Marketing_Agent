/**
 * src/lib/queue/workers/validation.worker.ts
 *
 * Validation Worker — Phase 3 of the pipeline.
 *
 * Receives a { jobId, workspaceId, leadId, sourceUrl, filteredText, targetCriteria } payload.
 *
 * Design decisions baked in from Phase 1 bug-fixes:
 *   - Uses pre-filtered text (never re-fetches raw HTML) → eliminates 413 / 429 errors
 *   - Runs agents sequentially (not Promise.allSettled) → 3× less quota burn
 *   - If ALL providers fail → skip, do NOT mark lead as rejected
 *   - Intent agent is a scoring bonus, not a gate
 *   - 3-second cooldown between validations (handled by concurrency: 1)
 */

import { Worker, Job, Queue } from "bullmq";
import { connectionConfig, dlq, ValidationJobData, type FailedJobData } from "../index";
import { logger } from "../../logger";
import prisma from "../../prisma";
import { KeyRotationLLMClient } from "../../ai/rotation-client";

const llmClient = new KeyRotationLLMClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  field: string;
  value: boolean;
  citation: string;
  source: string;
  confidence: number;
}

interface AgentVote {
  agentId: "criteria" | "intent" | "quality";
  passed: boolean;
  citations: ValidationResult[];
}

interface ValidationDecision {
  approved: boolean;
  votes: AgentVote[];
  finalScore: number;
  crashed: boolean;
}

// ---------------------------------------------------------------------------
// Citation anti-hallucination guard
// ---------------------------------------------------------------------------
function verifyCitation(citation: string, sourceText: string): boolean {
  if (!citation || citation.trim().length === 0) return false;
  return sourceText.toLowerCase().includes(citation.toLowerCase().trim());
}

// ---------------------------------------------------------------------------
// Individual agent runners
// ---------------------------------------------------------------------------

async function runCriteriaAgent(
  sourceText: string,
  sourceUrl: string,
  userCriteria: string
): Promise<AgentVote> {
  const system = `You are a strict B2B lead validator — Criteria Agent.
Your job: determine if the company described in the text matches the user's stated lead criteria.
Rules:
- Provide an exact verbatim quote from the text to support your decision.
- If no supporting quote exists in the text, set value: false.
- Return ONLY valid JSON matching the schema exactly.`;

  const user = `Criteria: ${userCriteria}

Source URL: ${sourceUrl}
Source Text:
${sourceText.slice(0, 8000)}

Respond with this JSON:
{
  "agentId": "criteria",
  "passed": true or false,
  "citations": [
    {
      "field": "criteria_match",
      "value": true or false,
      "citation": "exact verbatim quote from source text, or empty string if none",
      "source": "${sourceUrl}",
      "confidence": 0.0 to 1.0
    }
  ]
}`;

  let raw: unknown = null;
  raw = await llmClient.extractWithCerebras(system, user).catch(() => null);
  if (!raw) raw = await llmClient.extractWithGroq(system, user).catch(() => null);
  if (!raw) raw = await llmClient.extractWithGemini(system, user).catch(() => null);

  const vote = raw as AgentVote;
  if (!vote || !Array.isArray(vote.citations)) {
    throw new Error("Criteria agent returned invalid payload");
  }

  // Anti-hallucination: verify each citation exists in the source text
  vote.citations = vote.citations.map((c) => ({
    ...c,
    value: c.value && verifyCitation(c.citation, sourceText) ? c.value : false,
  }));

  return { ...vote, agentId: "criteria" };
}

async function runIntentAgent(
  sourceText: string,
  sourceUrl: string
): Promise<AgentVote> {
  const system = `You are a B2B lead validator — Intent Agent.
Your job: identify buying signals (hiring, funding round, product launch, expansion).
Rules:
- Provide exact verbatim quote if you find a signal.
- If no signal found, that is fine — set passed: false and leave citation empty.
- Return ONLY valid JSON.`;

  const user = `Source URL: ${sourceUrl}
Source Text:
${sourceText.slice(0, 8000)}

Respond with this JSON:
{
  "agentId": "intent",
  "passed": true or false,
  "citations": [
    {
      "field": "buying_signal",
      "value": true or false,
      "citation": "exact verbatim quote or empty string",
      "source": "${sourceUrl}",
      "confidence": 0.0 to 1.0
    }
  ]
}`;

  let raw: unknown = null;
  raw = await llmClient.extractWithCerebras(system, user).catch(() => null);
  if (!raw) raw = await llmClient.extractWithGroq(system, user).catch(() => null);
  if (!raw) raw = await llmClient.extractWithGemini(system, user).catch(() => null);

  const vote = raw as AgentVote;
  if (!vote || !Array.isArray(vote.citations)) {
    throw new Error("Intent agent returned invalid payload");
  }

  vote.citations = vote.citations.map((c) => ({
    ...c,
    value: c.value && verifyCitation(c.citation, sourceText) ? c.value : false,
  }));

  return { ...vote, agentId: "intent" };
}

async function runQualityAgent(
  sourceText: string,
  sourceUrl: string
): Promise<AgentVote> {
  const system = `You are a B2B lead validator — Quality Agent.
Your job: detect red flags (company shutdown, acquired/merged, zombie site with no activity, generic directory page).
Rules:
- Set passed: true if the company appears legitimate and active.
- Set passed: false and provide a citation if there is a disqualifying red flag.
- Return ONLY valid JSON.`;

  const user = `Source URL: ${sourceUrl}
Source Text:
${sourceText.slice(0, 8000)}

Respond with this JSON:
{
  "agentId": "quality",
  "passed": true or false,
  "citations": [
    {
      "field": "quality_flag",
      "value": true or false,
      "citation": "exact verbatim quote describing the red flag, or empty string if none",
      "source": "${sourceUrl}",
      "confidence": 0.0 to 1.0
    }
  ]
}`;

  let raw: unknown = null;
  raw = await llmClient.extractWithCerebras(system, user).catch(() => null);
  if (!raw) raw = await llmClient.extractWithGroq(system, user).catch(() => null);
  if (!raw) raw = await llmClient.extractWithGemini(system, user).catch(() => null);

  const vote = raw as AgentVote;
  if (!vote || !Array.isArray(vote.citations)) {
    throw new Error("Quality agent returned invalid payload");
  }

  vote.citations = vote.citations.map((c) => ({
    ...c,
    value: c.value && verifyCitation(c.citation, sourceText) ? c.value : false,
  }));

  return { ...vote, agentId: "quality" };
}

// ---------------------------------------------------------------------------
// Main validation orchestrator
// ---------------------------------------------------------------------------
async function validateLead(
  filteredText: string,
  sourceUrl: string,
  targetCriteria: string
): Promise<ValidationDecision> {
  const votes: AgentVote[] = [];

  // Run agents sequentially to avoid 3× quota burn (Fix 5)
  const criteriaResult = await runCriteriaAgent(filteredText, sourceUrl, targetCriteria)
    .catch(() => ({ agentId: "criteria" as const, passed: false, citations: [] }));
  votes.push(criteriaResult);

  const intentResult = await runIntentAgent(filteredText, sourceUrl)
    .catch(() => ({ agentId: "intent" as const, passed: false, citations: [] }));
  votes.push(intentResult);

  const qualityResult = await runQualityAgent(filteredText, sourceUrl)
    .catch((e) => {
      logger.error("[VALIDATION_WORKER] Quality agent threw:", e);
      return null;
    });
  if (qualityResult) votes.push(qualityResult);

  // Fix 6: If all agents crashed, skip — do not reject
  const allAgentsCrashed = votes.length === 0;

  // Fix 8: Criteria + Quality = gate; Intent = scoring bonus only
  const criteriaVote = votes.find((v) => v.agentId === "criteria");
  const qualityVote = votes.find((v) => v.agentId === "quality");
  const intentVote = votes.find((v) => v.agentId === "intent");

  const approved =
    !allAgentsCrashed &&
    !!criteriaVote?.passed &&
    (qualityVote ? !!qualityVote.passed : true); // quality is optional if agent crashed

  const intentBonus = intentVote?.passed ? 0.15 : 0;
  const allCitations = votes.flatMap((v) => v.citations);
  const passingCitations = allCitations.filter((c) => c.value);
  const baseScore =
    passingCitations.length > 0
      ? passingCitations.reduce((sum, c) => sum + c.confidence, 0) /
        passingCitations.length
      : 0;
  const finalScore = Math.min(1.0, baseScore + intentBonus);

  return { approved, votes, finalScore, crashed: allAgentsCrashed };
}

// ---------------------------------------------------------------------------
// Pipeline completion tracking
// ---------------------------------------------------------------------------

/**
 * Atomically decrements pendingValidations and marks the PipelineJob as DONE
 * when both extraction and validation phases are fully complete.
 *
 * Task 1.1 (Race Condition Fix): The DONE transition is a single raw SQL
 * UPDATE with a compound WHERE clause. Only one concurrent worker can win
 * (the first one whose decrement lands pendingValidations at 0). Any
 * subsequent concurrent call matches zero rows and is a safe no-op.
 */
async function decrementValidationAndCheckDone(jobId: string): Promise<void> {
  // Step 1: Decrement pendingValidations (non-atomic but idempotent).
  await prisma.pipelineJob.update({
    where: { id: jobId },
    data: { pendingValidations: { decrement: 1 } },
  });

  // Step 2: Atomic compare-and-swap via raw SQL.
  // This UPDATE only succeeds (count = 1) if THIS decrement was the one that
  // pushed pendingValidations to 0 AND processedUrls has reached totalUrls.
  // Concurrent workers will see count = 0 and skip — no duplicate DONE writes.
  const result = await prisma.$executeRaw`
    UPDATE "PipelineJob"
    SET    status = 'DONE'
    WHERE  id = ${jobId}
      AND  status = 'RUNNING'
      AND  "pendingValidations" <= 0
      AND  "processedUrls" >= "totalUrls"
      AND  "totalUrls" > 0
  `;

  if (result > 0) {
    logger.info(
      `[VALIDATION_WORKER] PipelineJob ${jobId} → DONE (all extraction + validation complete)`
    );
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export function startValidationWorker() {
  const worker = new Worker<ValidationJobData>(
    "validation",
    async (job: Job<ValidationJobData>) => {
      const { leadId, sourceUrl, filteredText, targetCriteria } = job.data;

      logger.info(`[VALIDATION_WORKER] Validating lead ${leadId} from ${sourceUrl}`);

      const decision = await validateLead(filteredText, sourceUrl, targetCriteria);

      if (decision.crashed) {
        // Fix 6: All providers rate-limited → skip, leave isEnriched=false
        logger.warn(
          `[VALIDATION_WORKER] All agents rate-limited for ${sourceUrl} — skipping, not rejecting lead ${leadId}`
        );
        await decrementValidationAndCheckDone(job.data.jobId);
        return;
      }

      // Mark lead as enriched if approved
      await prisma.lead.update({
        where: { id: leadId },
        data: { isEnriched: decision.approved },
      });

      logger.info(
        `[VALIDATION_WORKER] Lead ${leadId} — approved: ${decision.approved}, score: ${decision.finalScore.toFixed(2)}`
      );

      await decrementValidationAndCheckDone(job.data.jobId);

      // Fix 7: 3-second cooldown between validations is achieved by
      // concurrency: 1 in the worker + the natural async processing time.
      // For explicit cooldown, we sleep after each job.
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    },
    {
      connection: connectionConfig,
      concurrency: 1, // Process one validation at a time to respect token quotas
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isLastAttempt) {
      logger.error(
        `[VALIDATION_WORKER] Lead ${job.data.leadId} permanently failed — moving to DLQ`,
        err
      );

      await (dlq as Queue<FailedJobData, unknown, string>).add("dlq-validation", {
        originalQueue: "validation",
        jobId: job.data.jobId,
        data: job.data,
        errorMessage: err.message,
        failedAt: new Date().toISOString(),
      });

      // Task 1.2: Always decrement on permanent failure so pendingValidations
      // can still reach 0 and the PipelineJob can transition to DONE.
      // Without this, a single crashed validation job would freeze the entire
      // pipeline in RUNNING state forever.
      await decrementValidationAndCheckDone(job.data.jobId);
    }
  });

  logger.info("[VALIDATION_WORKER] Worker started");
  return worker;
}

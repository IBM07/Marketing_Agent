/**
 * src/lib/queue/workers/discovery.worker.ts
 *
 * Discovery Worker — Phase 1 of the pipeline.
 *
 * Receives a { jobId, workspaceId, prompt, userId } payload.
 * Steps:
 *   1. Call createAgentPlan() to get search queries + targetCriteria
 *   2. Run searchWeb() for each query to collect target URLs
 *   3. Update PipelineJob.totalUrls in the DB
 *   4. Fan-out one ExtractionJob per URL into the extractionQueue
 */

import { Worker, Job, Queue } from "bullmq";
import {
  connectionConfig,
  extractionQueue,
  dlq,
  DiscoveryJobData,
  type ExtractionJobData,
  type FailedJobData,
} from "../index";
import { createAgentPlan } from "../../agent/orchestrator";
import { searchWeb } from "../../scraper/search";
import { logger } from "../../logger";
import prisma from "../../prisma";
import { KeyRotationLLMClient } from "../../ai/rotation-client";

const llmClient = new KeyRotationLLMClient();

// ---------------------------------------------------------------------------
// Domain-level URL deduplication
//
// If Serper returns acme.com/contact, acme.com/team, and acme.com/about,
// all 3 would be scraped — burning 3× the quota for the same company.
// This deduplicator groups by root domain and keeps only the best URL
// per domain (priority: /contact > /about > /team > homepage).
// ---------------------------------------------------------------------------

/**
 * Score a URL by how likely it is to contain contact information.
 * Higher score = better URL to scrape for a given domain.
 */
function scoreUrlForContact(url: string): number {
  const path = url.toLowerCase();
  if (/\/contact/i.test(path)) return 100;
  if (/\/about/i.test(path)) return 80;
  if (/\/team/i.test(path)) return 70;
  if (/\/staff/i.test(path)) return 65;
  if (/\/people/i.test(path)) return 60;
  if (/\/leadership/i.test(path)) return 55;
  if (/\/our-team/i.test(path)) return 50;
  // Homepage or other paths get the lowest score
  return 10;
}

/**
 * Extract the root domain from a URL, stripping `www.` prefix.
 * Example: "https://www.acme.com/contact" → "acme.com"
 */
function extractRootDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    // If URL parsing fails, return the raw string as-is
    return url;
  }
}

/**
 * Deduplicates URLs at the domain level.
 * Groups by root domain and keeps only the highest-scoring URL per domain.
 *
 * @returns The deduplicated URL list
 */
function deduplicateByDomain(urls: string[]): string[] {
  const domainMap = new Map<string, { url: string; score: number }>();

  for (const url of urls) {
    const domain = extractRootDomain(url);
    const score = scoreUrlForContact(url);
    const existing = domainMap.get(domain);

    if (!existing || score > existing.score) {
      domainMap.set(domain, { url, score });
    }
  }

  return Array.from(domainMap.values()).map((entry) => entry.url);
}

/**
 * Pre-flight sanity gate.
 *
 * Runs a single lightweight LLM call to classify the user prompt as
 * valid (describes a real, existing business type) or invalid (fictional,
 * nonsensical, gibberish). This prevents wasting Serper + extraction
 * API quota on prompts that can never yield real leads.
 *
 * Returns { valid: true } or { valid: false, reason: string }.
 */
async function validatePromptSanity(
  prompt: string
): Promise<{ valid: boolean; reason?: string }> {
  const system = `You are a strict input validator for a B2B lead generation tool.
Your ONLY job: decide if the user's prompt describes a REAL, existing type of business, service, or professional that can be found on the internet today.

Rules:
- Return { "valid": true } if the prompt describes real businesses (e.g. "digital marketing agencies in NYC", "SaaS founders", "plumbers in London").
- Return { "valid": false, "reason": "..." } if the prompt is:
  * Fictional or impossible (e.g. "unicorns on Mars", "time-traveling accountants")
  * Pure gibberish or random characters (e.g. "sdkfjsdfsd asdf")
  * Not about finding businesses or professionals at all (e.g. "tell me a joke", "what is the weather")
- Be LENIENT with real-world prompts. If it describes ANY real industry, location, or profession, return valid: true.
- Be STRICT with clearly fake/impossible prompts. If the core subject doesn't exist in reality, return valid: false.
- Return ONLY valid JSON. No explanation outside the JSON.`;

  try {
    const result = await llmClient.extractWithGroq(system, prompt);
    if (result && typeof (result as unknown as { valid: boolean }).valid === "boolean") {
      return result as unknown as { valid: boolean; reason?: string };
    }
    // If parsing fails, default to valid — never block a real prompt due to LLM failure
    return { valid: true };
  } catch {
    // On any error, default to allowing the prompt through
    return { valid: true };
  }
}

export function startDiscoveryWorker() {
  const worker = new Worker<DiscoveryJobData>(
    "discovery",
    async (job: Job<DiscoveryJobData>) => {
      const { jobId, workspaceId, prompt } = job.data;

      logger.info(`[DISCOVERY_WORKER] Starting job ${jobId} — prompt: "${prompt}"`);

      // Mark the DB job as RUNNING
      await prisma.pipelineJob.update({
        where: { id: jobId },
        data: { status: "RUNNING" },
      });

      // ── Pre-flight sanity gate ─────────────────────────────────────────
      // Catches nonsensical/fictional prompts BEFORE any Serper or extraction
      // API calls are made. Fails gracefully — if the LLM itself errors,
      // we let the prompt through (never block a real user due to infra issues).
      const sanity = await validatePromptSanity(prompt);
      if (!sanity.valid) {
        const reason = sanity.reason || "The prompt does not describe a real business type or service.";
        logger.warn(`[DISCOVERY_WORKER] Job ${jobId} — prompt rejected by sanity gate: ${reason}`);
        await prisma.pipelineJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage: `Invalid prompt: ${reason}`,
          },
        });
        return; // Return normally — no retry needed for bad input
      }
      logger.info(`[DISCOVERY_WORKER] Prompt sanity check passed for job ${jobId}`);

      // Step 1: Orchestration → search queries + targetCriteria
      const plan = await createAgentPlan(prompt);
      logger.info(`[DISCOVERY_WORKER] Plan generated: ${JSON.stringify(plan)}`);

      if (!plan.searchQueries || plan.searchQueries.length === 0) {
        logger.warn(`[DISCOVERY_WORKER] Job ${jobId} — orchestrator returned empty queries. Marking FAILED.`);
        await prisma.pipelineJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage: "Could not generate search queries for this prompt. Try describing a specific real business type and location.",
          },
        });
        return;
      }

      // Step 2: Search phase — run all queries and merge unique URLs
      const allUrls = new Set<string>();
      for (const query of plan.searchQueries) {
        try {
          const urls = await searchWeb(query, 100);
          urls.forEach((u) => allUrls.add(u));
          logger.info(`[DISCOVERY_WORKER] Query "${query}" → ${urls.length} URLs`);
        } catch (err) {
          logger.warn(
            `[DISCOVERY_WORKER] Search query failed, skipping: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      const rawUrlList = Array.from(allUrls);

      // Step 2.5: Domain-level deduplication
      // Cuts token usage by ~40% — keeps only the best URL per root domain
      // (priority: /contact > /about > /team > homepage)
      const deduplicatedUrls = deduplicateByDomain(rawUrlList);
      logger.info(
        `[DISCOVERY_WORKER] Deduplicated ${rawUrlList.length} URLs → ${deduplicatedUrls.length} unique domains`
      );

      const targetUrls = deduplicatedUrls.slice(0, 200);
      logger.info(`[DISCOVERY_WORKER] ${targetUrls.length} target URLs after dedup + cap`);

      // Step 3: Update DB job with the total count
      await prisma.pipelineJob.update({
        where: { id: jobId },
        data: { totalUrls: targetUrls.length },
      });

      // Guard: if no URLs were found, the job cannot proceed. Mark as FAILED immediately
      // rather than leaving it stuck in RUNNING with no workers to ever complete it.
      if (targetUrls.length === 0) {
        logger.warn(`[DISCOVERY_WORKER] Job ${jobId} — zero URLs discovered. Marking FAILED.`);
        await prisma.pipelineJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage:
              "No target URLs were found for this prompt. Try broadening your search criteria.",
          },
        });
        return; // Return normally — do NOT throw. Throwing causes BullMQ to retry, which is wrong.
      }

      // Step 4: Fan-out one extraction job per URL
      const extractionJobs = targetUrls.map((url) => ({
        name: "extract",
        data: {
          jobId,
          workspaceId,
          url,
          targetCriteria: plan.targetCriteria,
        },
      }));

      await (extractionQueue as Queue<ExtractionJobData, unknown, string>).addBulk(extractionJobs);
      logger.info(`[DISCOVERY_WORKER] Enqueued ${extractionJobs.length} extraction jobs for pipeline job ${jobId}`);
    },
    {
      connection: connectionConfig,
      concurrency: 2, // max 2 discovery jobs running at once
    }
  );

  // Move permanently failed discovery jobs to DLQ
  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);
    if (isLastAttempt) {
      logger.error(`[DISCOVERY_WORKER] Job ${job.data.jobId} permanently failed — moving to DLQ`, err);

      await (dlq as Queue<FailedJobData, unknown, string>).add("dlq-discovery", {
        originalQueue: "discovery",
        jobId: job.data.jobId,
        data: job.data,
        errorMessage: err.message,
        failedAt: new Date().toISOString(),
      });

      // Mark PipelineJob as FAILED
      await prisma.pipelineJob.update({
        where: { id: job.data.jobId },
        data: {
          status: "FAILED",
          errorMessage: err.message,
        },
      }).catch(() => {/* best-effort */});
    }
  });

  logger.info("[DISCOVERY_WORKER] Worker started");
  return worker;
}

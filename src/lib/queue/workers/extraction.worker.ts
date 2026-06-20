/**
 * src/lib/queue/workers/extraction.worker.ts
 *
 * Extraction Worker — Phase 2 of the pipeline.
 *
 * Receives a { jobId, workspaceId, url, targetCriteria } payload.
 * Steps:
 *   1. Call extractLeadsFromUrl() to scrape and extract contacts from the URL
 *   2. Upsert each valid contact as a Lead in the database
 *   3. Enqueue a ValidationJob for each saved lead
 *   4. Increment PipelineJob.processedUrls counter
 */

import { Worker, Job, Queue } from "bullmq";
import {
  connectionConfig,
  validationQueue as valQueue,
  dlq,
  ExtractionJobData,
  type ValidationJobData,
  type FailedJobData,
} from "../index";
import { extractLeadsFromUrl } from "../../scraper/extractor";
import { validateEmail, MIN_EMAIL_CONFIDENCE } from "../../scraper/email-validator";
import { normalizeCompanyName, isDuplicateCompany } from "../../scraper/deduplicator";
import { logger } from "../../logger";
import prisma from "../../prisma";

export function startExtractionWorker() {
  const worker = new Worker<ExtractionJobData>(
    "extraction",
    async (job: Job<ExtractionJobData>) => {
      const { jobId, workspaceId, url, targetCriteria } = job.data;

      logger.info(`[EXTRACTION_WORKER] Processing URL: ${url} for job ${jobId}`);

      // Step 1: Scrape & extract
      const result = await extractLeadsFromUrl(url, targetCriteria);

      // Always increment processedUrls regardless of whether data was found
      await incrementProcessed(jobId);

      if (!result || !result.data || !Array.isArray(result.data.contacts)) {
        logger.info(`[EXTRACTION_WORKER] No contacts extracted from ${url}`);
        return;
      }

      // Task 2.2: filteredText is now part of the canonical return type — no cast needed.
      const { data, filteredText } = result;

      // Step 2: Validate and upsert leads into DB
      const savedLeadIds: { leadId: string; filteredText: string }[] = [];

      // Phase A2: Track normalized company names seen in THIS extraction batch
      // to prevent fuzzy duplicates within the same URL's contacts.
      const seenCompanyNames = new Set<string>();

      for (const contact of data.contacts) {
        if (!contact.email || !contact.email.includes("@")) continue;

        // Phase A1: Email MX validation — reject disposable/dead domains
        const emailCheck = await validateEmail(contact.email.trim().toLowerCase());
        if (emailCheck.confidence < MIN_EMAIL_CONFIDENCE) {
          logger.info(
            `[EXTRACTION_WORKER] Rejected email ${contact.email}: ${emailCheck.reason} (confidence: ${emailCheck.confidence})`
          );
          continue;
        }

        // Phase A2: Company deduplication — skip if fuzzy duplicate exists
        const companyName = data.companyName || "Unknown";
        if (companyName !== "Unknown" && isDuplicateCompany(companyName, seenCompanyNames)) {
          logger.info(
            `[EXTRACTION_WORKER] Skipped duplicate company "${companyName}" for email ${contact.email}`
          );
          continue;
        }
        // Track this company name for future dedup checks within the batch
        const normalized = normalizeCompanyName(companyName);
        if (normalized && normalized !== "unknown") {
          seenCompanyNames.add(normalized);
        }

        try {
          const lead = await prisma.lead.upsert({
            where: {
              workspaceId_email: {
                workspaceId,
                email: contact.email.trim().toLowerCase(),
              },
            },
            update: {
              companyName:
                data.companyName !== "Unknown" ? data.companyName : undefined,
              prospectName:
                contact.name !== "Unknown" ? contact.name : undefined,
              phone: contact.phone || undefined,
              role: contact.role !== "Unknown" ? contact.role : undefined,
              pipelineJobId: jobId,
              updatedAt: new Date(),
            },
            create: {
              workspaceId,
              email: contact.email.trim().toLowerCase(),
              companyName: data.companyName || "Unknown",
              prospectName: contact.name || "Prospect",
              phone: contact.phone || null,
              role: contact.role || "Unknown",
              scrapedFromUrl: url,
              pipelineJobId: jobId,
            },
          });

          savedLeadIds.push({
            leadId: lead.id,
            filteredText: filteredText ?? "",
          });
        } catch (dbErr) {
          // P2002 = unique constraint — already exists, no action needed
          const code = (dbErr as { code?: string })?.code;
          if (code !== "P2002") {
            logger.error(`[EXTRACTION_WORKER] Failed to upsert lead ${contact.email}:`, dbErr);
          }
        }
      }

      if (savedLeadIds.length === 0) return;

      // Increment leadsFound counter
      await prisma.pipelineJob.update({
        where: { id: jobId },
        data: { leadsFound: { increment: savedLeadIds.length } },
      });

      // Step 3: Enqueue validation for each saved lead
      const validationJobs = savedLeadIds.map(({ leadId, filteredText: ft }) => ({
        name: "validate",
        data: {
          jobId,
          workspaceId,
          leadId,
          sourceUrl: url,
          filteredText: ft,
          targetCriteria,
        },
      }));

      await (valQueue as Queue<ValidationJobData, unknown, string>).addBulk(validationJobs);

      // Register how many validation jobs are now in-flight for this pipeline job.
      // The DONE transition waits for this counter to reach zero.
      if (validationJobs.length > 0) {
        await prisma.pipelineJob.update({
          where: { id: jobId },
          data: { pendingValidations: { increment: validationJobs.length } },
        });
      }

      logger.info(
        `[EXTRACTION_WORKER] Saved ${savedLeadIds.length} leads from ${url}, enqueued validation`
      );
    },
    {
      connection: connectionConfig,
      concurrency: 5, // scrape up to 5 URLs in parallel
    }
  );

  // Move permanently failed extraction jobs to DLQ
  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);
    if (isLastAttempt) {
      logger.error(
        `[EXTRACTION_WORKER] URL ${job.data.url} permanently failed for job ${job.data.jobId}`,
        err
      );

      await (dlq as Queue<FailedJobData, unknown, string>).add("dlq-extraction", {
        originalQueue: "extraction",
        jobId: job.data.jobId,
        data: job.data,
        errorMessage: err.message,
        failedAt: new Date().toISOString(),
      });

      // Still count this URL as "processed" so the job can eventually finish
      await incrementProcessed(job.data.jobId);
    }
  });

  logger.info("[EXTRACTION_WORKER] Worker started");
  return worker;
}

/**
 * Atomically increments processedUrls.
 * The DONE transition is now handled exclusively by the validation worker
 * via decrementValidationAndCheckDone() to avoid marking jobs DONE
 * before validation completes.
 */
async function incrementProcessed(jobId: string): Promise<void> {
  await prisma.pipelineJob.update({
    where: { id: jobId },
    data: { processedUrls: { increment: 1 } },
  });
}

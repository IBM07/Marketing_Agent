/**
 * src/lib/queue/pipeline.ts
 *
 * Public API for the queue system.
 *
 * Call `startPipelineJob()` from the API route to:
 *   1. Create a PipelineJob record in the database (status: QUEUED)
 *   2. Enqueue a DiscoveryJob → which fans out to Extraction → Validation
 *   3. Return the jobId immediately (< 500ms to caller)
 */

import { Queue } from "bullmq";
import { discoveryQueue, type DiscoveryJobData } from "./index";
import prisma from "../prisma";
import { logger } from "../logger";

export interface StartPipelineResult {
  jobId: string;
  status: "queued";
}

export async function startPipelineJob(
  workspaceId: string,
  userId: string,
  prompt: string
): Promise<StartPipelineResult> {
  // 1. Persist a PipelineJob record so we can track status
  const pipelineJob = await prisma.pipelineJob.create({
    data: {
      workspaceId,
      prompt,
      status: "QUEUED",
    },
  });

  const jobId = pipelineJob.id;

  // 2. Enqueue the discovery job
  await (discoveryQueue as Queue<DiscoveryJobData, unknown, string>).add(
    "discover",
    {
      jobId,
      workspaceId,
      prompt,
      userId,
    },
    {
      jobId, // BullMQ job ID mirrors the DB record ID for easy lookup
    }
  );

  logger.info(`[PIPELINE] Job ${jobId} enqueued for workspace ${workspaceId}`);

  return { jobId, status: "queued" };
}

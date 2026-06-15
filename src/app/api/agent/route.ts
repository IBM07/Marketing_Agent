import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/errors";
import { getRateLimiter } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { startPipelineJob } from "@/lib/queue/pipeline";
import { getOrCreateWorkspace } from "@/lib/workspace";

/**
 * POST /api/agent
 *
 * Accepts { prompt, workspaceId? } and immediately returns { jobId, status: "queued" }.
 * The actual scraping / extraction / validation pipeline runs asynchronously
 * via BullMQ workers. Poll GET /api/agent/status?jobId=xxx for progress.
 */
export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }

  // Rate Limiting
  const rateLimiter = getRateLimiter();
  if (rateLimiter) {
    const { success } = await rateLimiter.limit(userId);
    if (!success) {
      throw new AppError(
        429,
        "Rate limit exceeded. Please wait a minute before trying again.",
        "RATE_LIMIT_ERROR"
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Invalid JSON payload");
  }

  const { prompt, workspaceId: requestedWorkspaceId } = body;
  if (!prompt || typeof prompt !== "string") {
    throw new ValidationError("A natural language 'prompt' is required");
  }

  logger.info(
    `[AGENT_ROUTE] Queueing async job for user: ${userId} with prompt: "${prompt}"`
  );

  const { workspace } = await getOrCreateWorkspace(userId);
  const targetWorkspaceId = requestedWorkspaceId || workspace.id;

  // Enqueue the pipeline — returns immediately with a jobId
  const result = await startPipelineJob(targetWorkspaceId, userId, prompt);

  return NextResponse.json({
    success: true,
    jobId: result.jobId,
    status: result.status,
    message:
      "Pipeline job queued. Poll GET /api/agent/status?jobId=" +
      result.jobId +
      " for progress.",
  });
});

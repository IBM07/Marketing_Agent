/**
 * GET /api/agent/status?jobId=xxx
 *
 * Returns the current state of a PipelineJob so the frontend can
 * display a real-time progress bar without WebSockets.
 *
 * Recommended poll interval: 3 seconds.
 *
 * Response shape:
 * {
 *   jobId: string
 *   status: "QUEUED" | "RUNNING" | "DONE" | "FAILED"
 *   totalUrls: number
 *   processedUrls: number
 *   leadsFound: number
 *   progressPct: number        // 0–100
 *   errorMessage: string | null
 *   createdAt: string (ISO)
 *   updatedAt: string (ISO)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/errors";
import prisma from "@/lib/prisma";

export const GET = apiHandler(async (req: NextRequest) => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    throw new ValidationError("'jobId' query parameter is required");
  }

  // Fetch the job and verify it belongs to the authenticated user's workspace
  const job = await prisma.pipelineJob.findUnique({
    where: { id: jobId },
    include: {
      workspace: {
        select: { userId: true },
      },
    },
  });

  if (!job) {
    throw new AppError(404, `PipelineJob ${jobId} not found`, "NOT_FOUND");
  }

  // Ownership check — look up the DB user record for this Clerk ID
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!dbUser || job.workspace.userId !== dbUser.id) {
    throw new AppError(
      403,
      "You do not have access to this pipeline job",
      "FORBIDDEN"
    );
  }

  const progressPct =
    job.totalUrls > 0
      ? Math.min(100, Math.round((job.processedUrls / job.totalUrls) * 100))
      : job.status === "DONE"
      ? 100
      : 0;

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    totalUrls: job.totalUrls,
    processedUrls: job.processedUrls,
    leadsFound: job.leadsFound,
    progressPct,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
});

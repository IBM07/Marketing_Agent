import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { ValidationError } from "@/lib/errors";

const UnsubscribeSchema = z.object({
  email: z.string().email("A valid email is required"),
  workspaceId: z.string().uuid("A valid workspace ID is required"),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/unsubscribe
 * Public endpoint (no auth) — called when a recipient clicks the opt-out link in an email.
 * Records their opt-out in the Unsubscribe table for GDPR/CAN-SPAM compliance.
 */
export const POST = apiHandler(async (req: Request) => {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Invalid JSON payload");
  }

  const validation = UnsubscribeSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError("A valid email and workspaceId are required");
  }

  const { email, workspaceId, reason } = validation.data;

  // Verify the workspace exists before inserting
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    // Return 200 anyway — don't leak whether a workspace exists
    return NextResponse.json({
      success: true,
      message: "You have been unsubscribed.",
    });
  }

  // Upsert — if already unsubscribed, this is idempotent
  await prisma.unsubscribe.upsert({
    where: {
      workspaceId_email: {
        workspaceId,
        email: email.trim().toLowerCase(),
      },
    },
    update: {
      reason: reason || null,
    },
    create: {
      workspaceId,
      email: email.trim().toLowerCase(),
      reason: reason || null,
    },
  });

  return NextResponse.json({
    success: true,
    message: "You have been successfully unsubscribed. We respect your decision.",
  });
});

/**
 * GET /api/unsubscribe?email=xxx&workspaceId=yyy
 * Check if an email is on the unsubscribe list (used by the dispatcher before sending).
 * No auth required — called server-side during campaign execution.
 */
export const GET = apiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const workspaceId = searchParams.get("workspaceId");

  if (!email || !workspaceId) {
    throw new ValidationError("email and workspaceId are required");
  }

  const record = await prisma.unsubscribe.findUnique({
    where: {
      workspaceId_email: {
        workspaceId,
        email: email.trim().toLowerCase(),
      },
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    isUnsubscribed: !!record,
    unsubscribedAt: record?.createdAt || null,
  });
});

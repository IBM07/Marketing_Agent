import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/errors";
import { validateLead } from "@/lib/agent/validator";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

/**
 * POST /api/validate
 *
 * Accepts:
 * {
 *   leadId:       string   — the Prisma Lead.id to validate
 *   sourceText:   string   — the raw text scraped from the lead's site
 *   userCriteria: string   — the original natural-language search criteria
 * }
 *
 * Returns a ValidationDecision, and if approved it sets lead.isEnriched = true.
 */
export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }

  let body: { leadId?: string; sourceText?: string; userCriteria?: string };
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Invalid JSON payload");
  }

  const { leadId, sourceText, userCriteria } = body;

  if (!leadId || typeof leadId !== "string") {
    throw new ValidationError("'leadId' (string) is required");
  }
  if (!sourceText || typeof sourceText !== "string" || sourceText.trim().length === 0) {
    throw new ValidationError("'sourceText' (non-empty string) is required");
  }
  if (!userCriteria || typeof userCriteria !== "string") {
    throw new ValidationError("'userCriteria' (string) is required");
  }

  // Verify the lead exists and belongs to a workspace owned by the requesting user
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      workspace: {
        include: { user: true },
      },
    },
  });

  if (!lead) {
    throw new AppError(404, "Lead not found", "LEAD_NOT_FOUND");
  }

  if (lead.workspace.user.clerkId !== userId) {
    throw new UnauthorizedError();
  }

  logger.info(
    `[VALIDATE_ROUTE] Running 3-agent validation for lead ${leadId} (${lead.email}) — workspace: ${lead.workspaceId}`
  );

  const decision = await validateLead(
    sourceText,
    lead.scrapedFromUrl,
    userCriteria
  );

  // If all 3 agents approved, mark the lead as enriched in the database
  if (decision.approved) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { isEnriched: true, updatedAt: new Date() },
    });
    logger.info(
      `[VALIDATE_ROUTE] Lead ${leadId} approved by all 3 agents — marked isEnriched=true`
    );
  } else {
    logger.info(
      `[VALIDATE_ROUTE] Lead ${leadId} did NOT pass all 3 agents — isEnriched unchanged`
    );
  }

  return NextResponse.json({
    success: true,
    leadId,
    email: lead.email,
    decision,
  });
});

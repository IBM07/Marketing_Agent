import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import prisma from "@/lib/prisma";
import { rateLimiter } from "@/lib/rate-limit";
import { apiHandler } from "@/lib/api-handler";
import {
  UnauthorizedError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  QuotaError,
} from "@/lib/errors";
import { dispatchEmailBatch } from "@/lib/mail/dispatcher";
import { getDailyEmailLimit } from "@/lib/mail/providerLimits";
import { logger } from "@/lib/logger";
import { getOrCreateWorkspace } from "@/lib/workspace";
/**
 * Detects raw HTTP/HTTPS URLs in plain text and wraps them in HTML anchor tags.
 * Safely ignores URLs that are already part of an HTML tag (e.g., href="...") 
 * or are wrapped inside an existing <a> element.
 */
function linkifyText(text: string): string {
  const parts = text.split(/(<[^>]+>)/g);
  let insideAnchor = false;
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) { // HTML tag
      if (/^<a\s/i.test(parts[i])) {
        insideAnchor = true;
      } else if (/^<\/a>/i.test(parts[i])) {
        insideAnchor = false;
      }
    } else if (!insideAnchor) { // Text node outside of <a>
      parts[i] = parts[i].replace(
        /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
        '<a href="$1">$1</a>'
      );
    }
  }
  return parts.join("");
}

const SendEmailSchema = z.object({
  campaignId: z.string().uuid(),
  recipients: z
    .array(z.string().email())
    .min(1, "At least one valid recipient is required")
    .max(500, "Max 500 recipients per request"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});


export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }

  const rateLimit = rateLimiter.check(userId, 5, 60000);
  if (!rateLimit.success) {
    throw new RateLimitError();
  }

  const body = await req.json();
  const validation = SendEmailSchema.safeParse(body);

  if (!validation.success) {
    throw new ValidationError("Validation failed", "VALIDATION_ERROR");
  }

  const { campaignId, recipients, subject, content } = validation.data;

  // ── Task 4.1: Sanitize HTML content before storage and sending ──────────
  // Prevents XSS and CSS-injection attacks from being forwarded to recipients.
  // Allows all standard email formatting tags; strips scripts and event attrs.
  const safeContent = sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "br", "p", "strong", "em", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "span", "div", "img",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "a": ["href", "target", "rel"],
      "img": ["src", "alt", "width", "height"],
      "span": ["style"],
      "p": ["style"],
      "div": ["style"],
    },
    allowedSchemes: ["https", "mailto"],
  });

  const { user: dbUser } = await getOrCreateWorkspace(userId);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { workspace: true },
  });

  if (
    !campaign ||
    campaign.workspace.userId !== dbUser.id ||
    campaign.deletedAt
  ) {
    throw new NotFoundError("Campaign not found or unauthorized");
  }

  // ── Filter out anyone who has unsubscribed from this workspace ──────────
  const unsubscribed = await prisma.unsubscribe.findMany({
    where: {
      workspaceId: campaign.workspaceId,
      email: { in: recipients.map(r => r.trim().toLowerCase()) },
    },
    select: { email: true },
  });
  const unsubEmails = new Set(unsubscribed.map(u => u.email));
  const filteredRecipients = recipients.filter(r => !unsubEmails.has(r.trim().toLowerCase()));

  if (filteredRecipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, message: "All recipients are unsubscribed." });
  }

  // ── Pre-flight quota check ─────────────────────────────────────────────
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const emailsSentToday = await prisma.emailLog.count({
    where: {
      campaign: { workspace: { userId: dbUser.id } },
      // BOUNCED and COMPLAINED still consume quota.
      // Only PENDING, FAILED, QUOTA_EXCEEDED do NOT consume quota.
      status: { notIn: ["PENDING", "FAILED", "QUOTA_EXCEEDED"] },
      sentAt: { gte: startOfToday },
    },
  });

  // Determine BYOK status early so we can compute the correct quota ceiling
  const hasByokConfig =
    dbUser.resendApiKey ||
    (dbUser.smtpHost && dbUser.smtpUser);
  const effectiveLimit = getDailyEmailLimit();

  const remaining = Math.max(0, effectiveLimit - emailsSentToday);

  if (remaining === 0) {
    throw new QuotaError("Daily limit reached. Try again after 24 hours.", emailsSentToday, effectiveLimit);
  }

  // ── Slice recipients to remaining quota ────────────────────────────────
  const recipientsToSend = filteredRecipients.slice(0, remaining);
  const recipientsSkipped = filteredRecipients.slice(remaining);

  // Resolve the mail config: prefer user BYOK credentials, fall back to platform Resend
  const userMailConfig = {
    smtpHost: dbUser.smtpHost,
    smtpPort: dbUser.smtpPort,
    smtpUser: dbUser.smtpUser,
    smtpPassword: dbUser.smtpPassword,
    senderEmail: dbUser.senderEmail,
    senderName: dbUser.senderName,
    resendApiKey: dbUser.resendApiKey,
  };

  // ── Detect provider for correct ID field + SMTP completion ─────────────
  const isSmtpSend = !!(userMailConfig.smtpHost && userMailConfig.smtpUser && !userMailConfig.resendApiKey);
  const isPlatformResend = !hasByokConfig && !!process.env.RESEND_API_KEY;
  const isResendSend = !!userMailConfig.resendApiKey || isPlatformResend;

  // ── Step 1: Send emails (bulk-safe) ────────────────────────────────────
  type SendResult = { recipient: string; success: boolean; messageId?: string; error?: string };
  let rawSendResults: SendResult[];

  if (hasByokConfig) {
    // BYOK path: dispatchEmailBatch handles Resend batch API or SMTP with
    // controlled concurrency (max 5 parallel) + 500 ms delay between chunks.
    rawSendResults = await dispatchEmailBatch(
      userMailConfig,
      recipientsToSend.map((recipient) => ({
        recipient,
        subject,
        htmlContent: linkifyText(safeContent).replace(/\n/g, "<br>"),
      }))
    );
  } else {
    // Platform fallback: use platform Resend batch API directly.
    const platformResendKey = process.env.RESEND_API_KEY;
    if (platformResendKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(platformResendKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

      if (fromEmail.includes("resend.dev") && process.env.NODE_ENV === "production") {
        throw new ValidationError(
          "RESEND_FROM_EMAIL is set to the Resend sandbox address (onboarding@resend.dev). " +
          "Emails sent from this address in production will be silently dropped or flagged as spam. " +
          "Set RESEND_FROM_EMAIL to a verified custom domain sender (e.g. noreply@yourdomain.com).",
          "SANDBOX_EMAIL_IN_PRODUCTION"
        );
      }

      const { data, error } = await resend.batch.send(
        recipientsToSend.map((recipient) => ({
          from: fromEmail,
          to: [recipient],
          subject,
          html: linkifyText(safeContent).replace(/\n/g, "<br>"),
        }))
      );

      const batchData = data?.data;
      rawSendResults = recipientsToSend.map((recipient, i) =>
        error
          ? { recipient, success: false, error: error.message }
          : { recipient, success: true, messageId: batchData?.[i]?.id }
      );
    } else {
      logger.warn(`[SEND_ROUTE] No mail configuration available for user ${userId}`);
      rawSendResults = recipientsToSend.map((recipient) => ({
        recipient,
        success: false,
        error: "No email credentials configured. Please add your SMTP or Resend API key in Settings.",
      }));
    }
  }

  // ── Step 2: Persist email logs (parallel DB writes) ────────────────────
  const sendResults = await Promise.allSettled(
    rawSendResults.map(async (result) => {
      const status = result.success ? "SENT" : "FAILED";

      const lead = await prisma.lead.findFirst({
        where: {
          email: result.recipient.trim().toLowerCase(),
          workspace: { userId: dbUser.id },
        },
        select: { id: true },
      });

      const emailLog = await prisma.emailLog.create({
        data: {
          campaignId,
          leadId: lead?.id || null,
          recipient: result.recipient,
          subject,
          content: safeContent,
          status,
          resendId: result.success && isResendSend ? result.messageId ?? null : null,
          smtpMessageId: result.success && isSmtpSend ? result.messageId ?? null : null,
          sentAt: status === "SENT" ? new Date() : null,
        },
      });

      return {
        recipient: result.recipient,
        status,
        logId: emailLog.id,
        error: result.error,
      };
    })
  );

  const successfulSends = sendResults.filter(
    (r) => r.status === "fulfilled" && r.value.status === "SENT"
  ).length;

  // ── Step 2b: Populate CampaignLead join table for ALL recipients ───────
  // Fetch Lead IDs for every recipient in this send (both sent and skipped).
  const allLeadsForCampaign = await prisma.lead.findMany({
    where: {
      email: { in: filteredRecipients.map(r => r.trim().toLowerCase()) },
      workspace: { userId: dbUser.id },
    },
    select: { id: true },
  });

  if (allLeadsForCampaign.length > 0) {
    await prisma.campaignLead.createMany({
      skipDuplicates: true,
      data: allLeadsForCampaign.map(lead => ({
        campaignId,
        leadId: lead.id,
      })),
    });
  }

  // ── Step 3: Persist QUOTA_EXCEEDED logs for skipped recipients ─────────
  if (recipientsSkipped.length > 0) {
    // Resolve leadId for each skipped recipient via a single batched query.
    const skippedLeads = await prisma.lead.findMany({
      where: {
        email: { in: recipientsSkipped.map(r => r.trim().toLowerCase()) },
        workspace: { userId: dbUser.id },
      },
      select: { id: true, email: true },
    });
    const skippedLeadMap = new Map(skippedLeads.map(l => [l.email.toLowerCase(), l.id]));

    await prisma.emailLog.createMany({
      data: recipientsSkipped.map(recipient => ({
        campaignId,
        leadId: skippedLeadMap.get(recipient.trim().toLowerCase()) ?? null,
        recipient,
        subject,
        content: safeContent,
        status: "QUOTA_EXCEEDED" as const,
        sentAt: null,
      })),
    });
  }

  // ── Step 4: Campaign status logic ──────────────────────────────────────
  if (successfulSends > 0 && recipientsSkipped.length > 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "PARTIAL" } });
  } else if (successfulSends > 0) {
    // SMTP has no webhooks — mark COMPLETED immediately. Resend uses webhooks.
    const finalStatus = isSmtpSend ? "COMPLETED" : "ACTIVE";
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: finalStatus } });
  }

  return NextResponse.json({
    success: true,
    sent: successfulSends,
    skipped: recipientsSkipped.length,
    unsubscribed: unsubEmails.size,
    quota: { used: emailsSentToday + successfulSends, limit: effectiveLimit, remaining: remaining - successfulSends },
    isPartial: recipientsSkipped.length > 0,
  });
});

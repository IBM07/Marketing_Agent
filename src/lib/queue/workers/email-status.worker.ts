/**
 * src/lib/queue/workers/email-status.worker.ts
 *
 * Email Status Poller Worker — polls the Resend API every 5 minutes
 * to update email statuses (delivered, opened, clicked, bounced, complained).
 *
 * This replaces the need for Resend webhooks, which require a publicly
 * accessible URL — making self-hosted / localhost deployments impossible.
 *
 * How it works:
 *   1. BullMQ repeatable job fires every 5 minutes
 *   2. Fetches all EmailLogs with status "SENT" + a valid resendId + sentAt within 7 days
 *   3. Calls GET /emails/{resendId} on the Resend API for each
 *   4. Updates the DB if the status has progressed (SENT → DELIVERED → OPENED → CLICKED)
 *   5. Handles spam complaints and bounces (auto-unsubscribe on COMPLAINED)
 */

import { Worker, Job } from "bullmq";
import {
  connectionConfig,
  emailStatusQueue,
  type EmailStatusPollJobData,
} from "../index";
import { logger } from "../../logger";
import prisma from "../../prisma";
import { decrypt } from "../../security";

// ---------------------------------------------------------------------------
// Resend status → our EmailStatus enum mapping
// ---------------------------------------------------------------------------
const RESEND_STATUS_MAP: Record<string, string> = {
  sent: "SENT",
  delivered: "DELIVERED",
  opened: "OPENED",
  clicked: "CLICKED",
  bounced: "BOUNCED",
  complained: "COMPLAINED",
  // "delivery_delayed" and other transient states stay as SENT
};

/**
 * Status hierarchy — a higher number means the email is further along
 * in its lifecycle. We only update if the new status is "higher".
 * This prevents a race condition where a poll returns "delivered" but
 * the email was already marked "opened" by an earlier poll or webhook.
 */
const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  CLICKED: 4,
  BOUNCED: 5,
  COMPLAINED: 6,
  FAILED: -1,
  QUOTA_EXCEEDED: -2,
};

// ---------------------------------------------------------------------------
// Core polling logic
// ---------------------------------------------------------------------------

async function pollEmailStatuses(): Promise<{ polled: number; updated: number }> {
  const resendApiKey = process.env.RESEND_API_KEY;

  // Only poll emails that:
  // 1. Were sent via Resend (have a resendId)
  // 2. Are in a "non-terminal" status (SENT or DELIVERED — we still want to catch opens/clicks)
  // 3. Were sent within the last 7 days (don't waste API calls on ancient emails)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const emailsToPoll = await prisma.emailLog.findMany({
    where: {
      resendId: { not: null },
      status: { in: ["SENT", "DELIVERED", "OPENED"] },
      sentAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      resendId: true,
      status: true,
      campaignId: true,
      recipient: true,
      campaign: {
        select: { 
          workspaceId: true,
          workspace: {
            select: {
              user: {
                select: { resendApiKey: true }
              }
            }
          }
        },
      },
    },
    take: 50, // Cap per cycle to stay within Resend rate limits
  });

  if (emailsToPoll.length === 0) {
    logger.info("[EMAIL_STATUS_WORKER] No emails to poll — skipping.");
    return { polled: 0, updated: 0 };
  }

  let updated = 0;

  // Process sequentially with a small delay to be respectful to Resend's API
  for (const emailLog of emailsToPoll) {
    try {
      let activeApiKey = resendApiKey;
      const encryptedKey = emailLog.campaign?.workspace?.user?.resendApiKey;
      
      if (encryptedKey) {
        try {
          activeApiKey = decrypt(encryptedKey);
        } catch {
          logger.warn(`[EMAIL_STATUS_WORKER] Failed to decrypt custom Resend key for workspace ${emailLog.campaign?.workspaceId}`);
        }
      }

      if (!activeApiKey) {
        logger.warn(`[EMAIL_STATUS_WORKER] No API key available for resendId=${emailLog.resendId} — skipping.`);
        continue;
      }

      const response = await fetch(`https://api.resend.com/emails/${emailLog.resendId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${activeApiKey}`,
        },
      });

      if (!response.ok) {
        // 404 = email was deleted from Resend, 429 = rate limited
        if (response.status === 429) {
          logger.warn("[EMAIL_STATUS_WORKER] Rate limited by Resend — stopping this cycle.");
          break;
        }
        if (response.status === 404) {
          logger.info(`[EMAIL_STATUS_WORKER] resendId=${emailLog.resendId} not found (404) — skipping.`);
          continue;
        }
        logger.warn(`[EMAIL_STATUS_WORKER] Resend API returned ${response.status} for ${emailLog.resendId}`);
        continue;
      }

      const data = await response.json() as { last_event?: string };
      const resendEvent = data.last_event;

      if (!resendEvent) continue;

      const mappedStatus = RESEND_STATUS_MAP[resendEvent];
      if (!mappedStatus) continue;

      // Only update if the new status is further along in the lifecycle
      const currentRank = STATUS_RANK[emailLog.status] ?? 0;
      const newRank = STATUS_RANK[mappedStatus] ?? 0;

      if (newRank > currentRank) {
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            status: mappedStatus as import("@prisma/client").EmailStatus,
          },
        });

        updated++;
        logger.info(
          `[EMAIL_STATUS_WORKER] Updated resendId=${emailLog.resendId} — ${emailLog.status} → ${mappedStatus}`
        );

        // Auto-unsubscribe on spam complaint (same logic as webhook handler)
        if (mappedStatus === "COMPLAINED" && emailLog.campaign?.workspaceId) {
          const recipientEmail = emailLog.recipient.trim().toLowerCase();
          await prisma.unsubscribe.upsert({
            where: {
              workspaceId_email: {
                workspaceId: emailLog.campaign.workspaceId,
                email: recipientEmail,
              },
            },
            update: { reason: "Spam complaint detected via status poll" },
            create: {
              workspaceId: emailLog.campaign.workspaceId,
              email: recipientEmail,
              reason: "Spam complaint detected via status poll",
            },
          });
          logger.info(
            `[EMAIL_STATUS_WORKER] Auto-unsubscribed ${recipientEmail} due to spam complaint.`
          );
        }

        // Check if ALL emails in campaign now have terminal status → mark COMPLETED
        if (emailLog.campaignId) {
          const terminalStatuses = ["DELIVERED", "OPENED", "CLICKED", "FAILED", "BOUNCED", "COMPLAINED"];
          const pendingCount = await prisma.emailLog.count({
            where: {
              campaignId: emailLog.campaignId,
              status: { notIn: [...terminalStatuses, "QUOTA_EXCEEDED"] as import("@prisma/client").EmailStatus[] },
            },
          });
          const quotaCount = await prisma.emailLog.count({
            where: { campaignId: emailLog.campaignId, status: "QUOTA_EXCEEDED" },
          });

          if (pendingCount === 0 && quotaCount === 0) {
            await prisma.campaign.update({
              where: { id: emailLog.campaignId },
              data: { status: "COMPLETED" },
            });
            logger.info(`[EMAIL_STATUS_WORKER] Campaign ${emailLog.campaignId} marked COMPLETED`);
          }
        }
      }

      // Small delay between API calls (200ms) to avoid hammering Resend
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (err) {
      logger.warn(
        `[EMAIL_STATUS_WORKER] Error polling resendId=${emailLog.resendId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return { polled: emailsToPoll.length, updated };
}

// ---------------------------------------------------------------------------
// Worker setup + repeatable job registration
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startEmailStatusPollerWorker() {
  const worker = new Worker<EmailStatusPollJobData>(
    "email-status",
    async (_job: Job<EmailStatusPollJobData>) => {
      logger.info("[EMAIL_STATUS_WORKER] Starting poll cycle...");
      const result = await pollEmailStatuses();
      logger.info(
        `[EMAIL_STATUS_WORKER] Poll cycle complete — polled ${result.polled} emails, updated ${result.updated}.`
      );
    },
    {
      connection: connectionConfig,
      concurrency: 1, // Only one poll at a time
    }
  );

  // Register the repeatable job (BullMQ deduplicates by key — safe to call on every startup)
  emailStatusQueue
    .add(
      "poll-email-status",
      { triggeredAt: new Date().toISOString() },
      {
        repeat: { every: POLL_INTERVAL_MS },
        jobId: "email-status-poller", // Stable ID prevents duplicate repeatable jobs
      }
    )
    .then(() => {
      logger.info(
        `[EMAIL_STATUS_WORKER] Repeatable job registered — polling every ${POLL_INTERVAL_MS / 1000}s`
      );
    })
    .catch((err) => {
      logger.error("[EMAIL_STATUS_WORKER] Failed to register repeatable job:", err);
    });

  worker.on("failed", (_job, err) => {
    logger.error("[EMAIL_STATUS_WORKER] Poll cycle failed:", err);
  });

  logger.info("[EMAIL_STATUS_WORKER] Worker started");
  return worker;
}

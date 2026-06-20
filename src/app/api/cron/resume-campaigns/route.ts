import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dispatchEmailBatch } from "@/lib/mail/dispatcher";
import { getDailyEmailLimit } from "@/lib/mail/providerLimits";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // 1. Security: validate CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Find PARTIAL campaigns that are not deleted
  const partialCampaigns = await prisma.campaign.findMany({
    where: { status: "PARTIAL", deletedAt: null },
    include: { workspace: { include: { user: true } } },
  });

  const results = [];

  for (const campaign of partialCampaigns) {
    const dbUser = campaign.workspace.user;

    // 3. Check user's quota for today
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const emailsSentToday = await prisma.emailLog.count({
      where: {
        campaign: { workspace: { userId: dbUser.id } },
        status: { notIn: ["PENDING", "FAILED", "QUOTA_EXCEEDED"] },
        sentAt: { gte: startOfToday },
      },
    });
    const remaining = Math.max(0, getDailyEmailLimit() - emailsSentToday);

    if (remaining === 0) {
      results.push({ campaignId: campaign.id, skipped: "no quota" });
      continue;
    }

    // 4. Fetch QUOTA_EXCEEDED logs for this campaign
    const quotaLogs = await prisma.emailLog.findMany({
      where: { campaignId: campaign.id, status: "QUOTA_EXCEEDED" },
      take: remaining, // CRITICAL: slice to remaining quota
    });

    if (quotaLogs.length === 0) {
      // Edge case: no quota logs but status is PARTIAL — fix it
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });
      continue;
    }

    // 5. Filter out anyone who unsubscribed since original send
    const unsubscribed = await prisma.unsubscribe.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        email: { in: quotaLogs.map(l => l.recipient.toLowerCase()) },
      },
      select: { email: true },
    });
    const unsubEmails = new Set(unsubscribed.map(u => u.email));
    const logsToSend = quotaLogs.filter(l => !unsubEmails.has(l.recipient.toLowerCase()));

    // Mark unsubscribed as FAILED (they won't be sent)
    const unsubLogIds = quotaLogs.filter(l => unsubEmails.has(l.recipient.toLowerCase())).map(l => l.id);
    if (unsubLogIds.length > 0) {
      await prisma.emailLog.updateMany({ where: { id: { in: unsubLogIds } }, data: { status: "FAILED" } });
    }

    // 6. Resolve mail config
    const userMailConfig = {
      smtpHost: dbUser.smtpHost, smtpPort: dbUser.smtpPort,
      smtpUser: dbUser.smtpUser, smtpPassword: dbUser.smtpPassword,
      senderEmail: dbUser.senderEmail, senderName: dbUser.senderName,
      resendApiKey: dbUser.resendApiKey,
    };

    // 7. Send the resumed emails
    const sendResults = await dispatchEmailBatch(
      userMailConfig,
      logsToSend.map(l => ({ recipient: l.recipient, subject: l.subject, htmlContent: l.content }))
    );

    // 8. Update each EmailLog status
    const isSmtpSend = !!(userMailConfig.smtpHost && userMailConfig.smtpUser && !userMailConfig.resendApiKey);
    for (let i = 0; i < sendResults.length; i++) {
      const result = sendResults[i];
      const log = logsToSend[i];
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? "SENT" : "FAILED",
          sentAt: result.success ? new Date() : null,
          resendId: result.success && !isSmtpSend ? result.messageId ?? null : null,
          smtpMessageId: result.success && isSmtpSend ? result.messageId ?? null : null,
        },
      });
    }

    // 9. Check if any QUOTA_EXCEEDED logs remain
    const remainingQuotaCount = await prisma.emailLog.count({
      where: { campaignId: campaign.id, status: "QUOTA_EXCEEDED" },
    });

    if (remainingQuotaCount === 0) {
      // All emails resolved — SMTP = COMPLETED immediately, Resend = ACTIVE (webhooks drive COMPLETED)
      const finalStatus = isSmtpSend ? "COMPLETED" : "ACTIVE";
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: finalStatus } });
    }
    // Else: still has QUOTA_EXCEEDED → stays PARTIAL for tomorrow's cron

    results.push({ campaignId: campaign.id, sent: sendResults.filter(r => r.success).length });
    logger.info(`[CRON] Resumed campaign ${campaign.id}: sent ${sendResults.filter(r => r.success).length}`);
  }

  return Response.json({ success: true, results });
}

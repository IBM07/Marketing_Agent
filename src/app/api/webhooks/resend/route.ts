import { NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const payload = await req.text();
    const headersList = req.headers;
    const svix_id = headersList.get("svix-id");
    const svix_timestamp = headersList.get("svix-timestamp");
    const svix_signature = headersList.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new NextResponse("Missing svix headers", { status: 400 });
    }

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.warn(
        "RESEND_WEBHOOK_SECRET is not set. Webhook validation will fail in production."
      );
      return new NextResponse("Webhook secret not configured", { status: 500 });
    }

    const wh = new Webhook(webhookSecret);
    let evt: { type: string; data: { email_id: string; to?: string[] } };

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as { type: string; data: { email_id: string; to?: string[] } };
    } catch (err) {
      logger.error("Error verifying Resend webhook:", err);
      return new NextResponse("Invalid signature", { status: 400 });
    }

    const { type, data } = evt;
    const emailId = data.email_id;

    if (!emailId) {
      return new NextResponse("Email ID missing in webhook payload", {
        status: 400,
      });
    }

    // Map Resend event types to our EmailStatus enum
    const statusMap: Record<string, string> = {
      "email.sent": "SENT",
      "email.delivered": "DELIVERED",
      "email.opened": "OPENED",
      "email.clicked": "CLICKED",
      "email.bounced": "BOUNCED",
      "email.complained": "COMPLAINED",
    };

    const statusToUpdate = statusMap[type] ?? null;

    if (statusToUpdate) {
      // Update the email log — updatedAt is automatically set via @updatedAt
      const updatedLog = await prisma.emailLog.update({
        where: { resendId: emailId },
        data: {
          status: statusToUpdate as import("@prisma/client").EmailStatus,
        },
        include: {
          campaign: {
            select: { workspaceId: true, id: true },
          },
        },
      });

      logger.info(
        `[WEBHOOK] Updated EmailLog resendId=${emailId} → status=${statusToUpdate}`
      );

      // If the user complained (spam), auto-add them to the Unsubscribe list
      // so we never email them again from this workspace (GDPR/CAN-SPAM compliance)
      if (statusToUpdate === "COMPLAINED" && updatedLog.campaign?.workspaceId) {
        const recipientEmail = updatedLog.recipient.trim().toLowerCase();
        await prisma.unsubscribe.upsert({
          where: {
            workspaceId_email: {
              workspaceId: updatedLog.campaign.workspaceId,
              email: recipientEmail,
            },
          },
          update: { reason: "Spam complaint via Resend webhook" },
          create: {
            workspaceId: updatedLog.campaign.workspaceId,
            email: recipientEmail,
            reason: "Spam complaint via Resend webhook",
          },
        });
        logger.info(
          `[WEBHOOK] Auto-unsubscribed ${recipientEmail} from workspace ${updatedLog.campaign.workspaceId} due to spam complaint.`
        );
      }

      // If ALL emails in a campaign have a terminal status, mark it COMPLETED
      if (updatedLog.campaign?.id) {
        const campaignId = updatedLog.campaign.id;
        const terminalStatuses = ["SENT","DELIVERED","OPENED","CLICKED","FAILED","BOUNCED","COMPLAINED"];

        const pendingCount = await prisma.emailLog.count({
          where: { campaignId, status: { notIn: [...terminalStatuses, "QUOTA_EXCEEDED"] as import("@prisma/client").EmailStatus[] } },
        });
        const quotaCount = await prisma.emailLog.count({
          where: { campaignId, status: "QUOTA_EXCEEDED" },
        });

        if (pendingCount === 0 && quotaCount === 0) {
          await prisma.campaign.update({ where: { id: campaignId }, data: { status: "COMPLETED" } });
          logger.info(`[WEBHOOK] Campaign ${campaignId} marked COMPLETED`);
        }
        // If quotaCount > 0 → campaign stays PARTIAL, cron handles it
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Webhook processing error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

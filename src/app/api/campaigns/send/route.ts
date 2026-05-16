import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { rateLimiter } from "@/lib/rate-limit";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, NotFoundError, RateLimitError, ValidationError } from "@/lib/errors";

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const SendEmailSchema = z.object({
  campaignId: z.string().uuid(),
  recipients: z.array(z.string().email())
    .min(1, "At least one valid recipient is required")
    .max(50, "Max 50 recipients per request allowed to prevent timeouts"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

async function sendEmailWithRetry(recipient: string, subject: string, content: string, maxRetries = 3) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Acme <onboarding@resend.dev>";
  
  if (fromEmail.includes("resend.dev") && process.env.NODE_ENV === "production") {
    console.warn("[WARNING] Using sandbox email in production. Deliverability may be affected.");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (resend) {
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: [recipient],
          subject: subject,
          html: escapeHtml(content).replace(/\n/g, "<br>"),
        });

        if (error) {
          throw new Error(error.message);
        }
        return { success: true, messageId: data?.id };
      } else {
        console.log(`[MOCK_EMAIL_SEND] To: ${recipient} | Subject: ${subject}`);
        return { success: true, messageId: "mock-id" };
      }
    } catch (err) {
      if (attempt === maxRetries) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

async function getOrCreateUser(userId: string) {
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) throw new UnauthorizedError();
    const email = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@placeholder.com`;
    
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        workspaces: {
          create: {
            name: `${clerkUser.firstName || 'My'} Workspace`,
          }
        }
      }
    });
  }

  return user;
}

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

  const dbUser = await getOrCreateUser(userId);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { workspace: true },
  });

  if (!campaign || campaign.workspace.userId !== dbUser.id || campaign.deletedAt) {
    throw new NotFoundError("Campaign not found or unauthorized");
  }

  // Batch process emails
  const sendResults = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const result = await sendEmailWithRetry(recipient, subject, content);
      
      const status = result.success ? "SENT" : "FAILED";
      
      const emailLog = await prisma.emailLog.create({
        data: {
          campaignId,
          recipient,
          subject,
          content,
          status,
          resendId: result.success ? result.messageId : null,
          sentAt: status === "SENT" ? new Date() : null,
        },
      });

      return { recipient, status, logId: emailLog.id, error: result.error };
    })
  );

  const successfulSends = sendResults.filter(
    (r) => r.status === "fulfilled" && r.value.status === "SENT"
  ).length;

  // Update campaign status to ACTIVE if it's currently DRAFT and we had successful sends
  if (campaign.status === "DRAFT" && successfulSends > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "ACTIVE" },
    });
  }

  return NextResponse.json({ success: true, count: successfulSends, results: sendResults });
});

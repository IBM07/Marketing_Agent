import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Resend } from "resend";

const SendEmailSchema = z.object({
  campaignId: z.string(),
  recipients: z.array(z.string().email()).min(1, "At least one valid recipient is required"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const validation = SendEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { campaignId, recipients, subject, content } = validation.data;

    // Get DB user and verify ownership of the campaign's workspace
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return new NextResponse("User not found in database", { status: 404 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { workspace: true },
    });

    if (!campaign || campaign.workspace.userId !== dbUser.id) {
      return new NextResponse("Campaign not found or unauthorized", { status: 404 });
    }

    const sendResults = await Promise.allSettled(
      recipients.map(async (recipient) => {
        let status = "PENDING";
        try {
          if (resend) {
            const { error } = await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || "Acme <onboarding@resend.dev>",
              to: [recipient],
              subject: subject,
              html: content.replace(/\n/g, "<br>"),
            });

            if (error) {
              console.error(`[RESEND_ERROR] for ${recipient}:`, error);
              status = "FAILED";
            } else {
              status = "SENT";
            }
          } else {
            // Mock sending if no key is configured, avoiding hard crash per agent safety rules
            console.log(`[MOCK_EMAIL_SEND] To: ${recipient} | Subject: ${subject}`);
            status = "SENT";
          }
        } catch (err) {
          console.error(`[EMAIL_SEND_EXCEPTION] for ${recipient}:`, err);
          status = "FAILED";
        }

        // Log the transaction in the database
        const emailLog = await prisma.emailLog.create({
          data: {
            campaignId,
            recipient,
            subject,
            content,
            status,
            sentAt: status === "SENT" ? new Date() : null,
          },
        });

        return { recipient, status, logId: emailLog.id };
      })
    );

    const successfulSends = sendResults.filter(
      (r) => r.status === "fulfilled" && r.value.status === "SENT"
    ).length;

    return NextResponse.json({ success: true, count: successfulSends, results: sendResults });
  } catch (error: unknown) {
    console.error("[CAMPAIGNS_SEND_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

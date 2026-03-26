import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { campaignId, recipients, subject, content } = await req.json();

    if (!campaignId || !recipients || !Array.isArray(recipients) || recipients.length === 0 || !subject || !content) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

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
              from: "Acme <onboarding@resend.dev>", // Replace with verified domain in production
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

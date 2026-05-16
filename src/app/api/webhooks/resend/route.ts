import { NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";

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
      console.warn("RESEND_WEBHOOK_SECRET is not set in environment variables. Webhook validation will fail in production.");
      return new NextResponse("Webhook secret not configured", { status: 500 });
    }

    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return new NextResponse("Invalid signature", { status: 400 });
    }

    // Process the Resend event
    const { type, data } = evt;
    const emailId = data.email_id;

    if (!emailId) {
      return new NextResponse("Email ID missing in webhook payload", { status: 400 });
    }

    let statusToUpdate: string | null = null;

    switch (type) {
      case "email.sent":
        statusToUpdate = "SENT";
        break;
      case "email.delivered":
        statusToUpdate = "DELIVERED";
        break;
      case "email.opened":
        statusToUpdate = "OPENED";
        break;
      case "email.clicked":
        statusToUpdate = "CLICKED";
        break;
      case "email.bounced":
        statusToUpdate = "BOUNCED";
        break;
      case "email.complained":
        statusToUpdate = "COMPLAINED";
        break;
      case "email.delivery_delayed":
        // Ignoring or logging delayed event
        break;
    }

    if (statusToUpdate) {
      await prisma.emailLog.update({
        where: {
          resendId: emailId,
        },
        data: {
          status: statusToUpdate as any, // casting as any to bypass strict prisma types until generation
        },
      });
      console.log(`Updated email log for Resend ID ${emailId} to status ${statusToUpdate}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

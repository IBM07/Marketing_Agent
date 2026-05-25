import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { encrypt } from "@/lib/security";
import { DAILY_EMAIL_LIMIT } from "@/lib/mail/providerLimits";

const MASK = "••••••••";

const SettingsSchema = z.object({
  resendApiKey: z.string().optional(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional(),
  senderEmail: z.string().email().optional().nullable(),
  senderName: z.string().optional().nullable(),
});

async function getOrCreateUser(clerkUserId: string) {
  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) throw new UnauthorizedError();
    const email =
      clerkUser.emailAddresses[0]?.emailAddress ||
      `${clerkUserId}@placeholder.com`;

    user = await prisma.user.create({
      data: {
        clerkId: clerkUserId,
        email,
        workspaces: {
          create: {
            name: `${clerkUser.firstName || "My"} Workspace`,
          },
        },
      },
    });
  }

  return user;
}

// ── GET — Load settings (masked secrets) ──────────────────────────────────
export const GET = apiHandler(async () => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const user = await getOrCreateUser(userId);

  // Calculate today's quota
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const emailsSentToday = await prisma.emailLog.count({
    where: {
      campaign: { workspace: { userId: user.id } },
      status: { notIn: ["PENDING", "FAILED", "QUOTA_EXCEEDED"] },
      sentAt: { gte: startOfToday },
    },
  });

  const remaining = Math.max(0, DAILY_EMAIL_LIMIT - emailsSentToday);

  return NextResponse.json({
    resendApiKey: user.resendApiKey ? MASK : null,
    smtpHost: user.smtpHost,
    smtpPort: user.smtpPort,
    smtpUser: user.smtpUser,
    smtpPassword: user.smtpPassword ? MASK : null,
    senderEmail: user.senderEmail,
    senderName: user.senderName,
    quota: { used: emailsSentToday, limit: DAILY_EMAIL_LIMIT, remaining },
  });
});

// ── POST — Save settings with smart masking logic ─────────────────────────
export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const user = await getOrCreateUser(userId);

  const body = await req.json();
  const validation = SettingsSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError("Invalid settings data");
  }

  const data = validation.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {};

  // Smart masking logic for encrypted fields:
  // - "••••••••" → skip (user didn't change it)
  // - "" (empty) → set to null (clear the key)
  // - new string → encrypt() it → save
  if (data.resendApiKey !== undefined && data.resendApiKey !== MASK) {
    updatePayload.resendApiKey = data.resendApiKey === "" ? null : encrypt(data.resendApiKey);
  }
  if (data.smtpPassword !== undefined && data.smtpPassword !== MASK) {
    updatePayload.smtpPassword = data.smtpPassword === "" ? null : encrypt(data.smtpPassword);
  }

  // Plain-text fields → save directly
  if (data.smtpHost !== undefined) updatePayload.smtpHost = data.smtpHost || null;
  if (data.smtpPort !== undefined) updatePayload.smtpPort = data.smtpPort;
  if (data.smtpUser !== undefined) updatePayload.smtpUser = data.smtpUser || null;
  if (data.senderEmail !== undefined) updatePayload.senderEmail = data.senderEmail || null;
  if (data.senderName !== undefined) updatePayload.senderName = data.senderName || null;

  if (Object.keys(updatePayload).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: updatePayload,
    });
  }

  return NextResponse.json({ success: true, message: "Settings saved successfully." });
});

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError } from "@/lib/errors";

export const GET = apiHandler(async (_req: Request) => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  // Check if env variables exist
  return NextResponse.json({
    resendConfigured: !!process.env.RESEND_API_KEY,
    groqConfigured: !!process.env.GROQ_API_KEY,
    databaseConnected: !!process.env.DATABASE_URL,
    webhookSecretSet: !!process.env.RESEND_WEBHOOK_SECRET
  });
});

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, NotFoundError } from "@/lib/errors";

export const GET = apiHandler(async (req: Request, context: unknown) => {
  // Await params FIRST — Next.js 15 requires this before any property access
  const { params } = context as { params: Promise<{ id: string }> };
  const { id: campaignId } = await params;

  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    throw new UnauthorizedError("No workspace found");
  }

  const workspaceId = user.workspaces[0].id;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      emailLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign || campaign.workspaceId !== workspaceId || campaign.deletedAt) {
    throw new NotFoundError("Campaign not found");
  }

  return NextResponse.json(campaign);
});

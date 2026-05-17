import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, NotFoundError } from "@/lib/errors";

export const GET = apiHandler(async (req: Request, context: unknown) => {
  const { params } = context as { params: { id: string } };
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
  const campaignId = params.id;

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

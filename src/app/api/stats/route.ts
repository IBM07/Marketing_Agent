import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError } from "@/lib/errors";

export const GET = apiHandler(async (_req: Request) => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  // Get user's workspace
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    return NextResponse.json({
      activeCampaigns: 0,
      totalSent: 0,
      totalDelivered: 0,
      deliveryRate: "0%"
    });
  }

  const workspaceId = user.workspaces[0].id;

  // 1. Get Active Campaigns count
  const activeCampaigns = await prisma.campaign.count({
    where: {
      workspaceId,
      status: "ACTIVE",
      deletedAt: null,
    }
  });

  // 2. Get Email Stats across all campaigns in this workspace
  const emailLogs = await prisma.emailLog.findMany({
    where: {
      campaign: {
        workspaceId,
      }
    },
    select: {
      status: true,
    }
  });

  const totalSent = emailLogs.filter(log => ["SENT", "DELIVERED", "OPENED", "CLICKED"].includes(log.status)).length;
  const totalDelivered = emailLogs.filter(log => ["DELIVERED", "OPENED", "CLICKED"].includes(log.status)).length;
  
  const deliveryRate = totalSent > 0 
    ? `${((totalDelivered / totalSent) * 100).toFixed(1)}%` 
    : "0%";

  return NextResponse.json({
    activeCampaigns,
    totalSent,
    totalDelivered,
    deliveryRate
  });
});

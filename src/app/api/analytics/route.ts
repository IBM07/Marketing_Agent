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

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    return NextResponse.json({ chartData: [], summary: {} });
  }

  const workspaceId = user.workspaces[0].id;

  // Get all email logs for this workspace
  const emailLogs = await prisma.emailLog.findMany({
    where: {
      campaign: {
        workspaceId,
        deletedAt: null,
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate by date
  const aggregated: Record<string, { sent: number, opened: number, clicked: number, failed: number }> = {};
  
  emailLogs.forEach(log => {
    // using ISO string up to 'YYYY-MM-DD'
    const dateStr = log.createdAt.toISOString().split('T')[0];
    if (!aggregated[dateStr]) {
      aggregated[dateStr] = { sent: 0, opened: 0, clicked: 0, failed: 0 };
    }
    
    if (["SENT", "DELIVERED", "OPENED", "CLICKED"].includes(log.status)) {
      aggregated[dateStr].sent += 1;
    }
    if (["OPENED", "CLICKED"].includes(log.status)) {
      aggregated[dateStr].opened += 1;
    }
    if (log.status === "CLICKED") {
      aggregated[dateStr].clicked += 1;
    }
    if (["FAILED", "BOUNCED", "COMPLAINED"].includes(log.status)) {
      aggregated[dateStr].failed += 1;
    }
  });

  const chartData = Object.keys(aggregated).sort().map(date => ({
    date,
    ...aggregated[date]
  }));

  const totalSent = chartData.reduce((acc, curr) => acc + curr.sent, 0);
  const totalOpened = chartData.reduce((acc, curr) => acc + curr.opened, 0);
  const totalClicked = chartData.reduce((acc, curr) => acc + curr.clicked, 0);

  const summary = {
    totalSent,
    openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0",
    clickRate: totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0"
  };

  return NextResponse.json({ chartData, summary });
});

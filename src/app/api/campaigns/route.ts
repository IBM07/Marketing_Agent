import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

const CampaignSchema = z.object({
  name: z.string().min(1, "Name is required"),
  goal: z.string().optional(),
  targetAudience: z.string().optional(),
});

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { workspaces: true },
    });

    if (!user || user.workspaces.length === 0) {
      return new NextResponse("Not Found: User or Workspace does not exist", { status: 404 });
    }

    const workspace = user.workspaces[0];

    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (error: unknown) {
    console.error("[CAMPAIGNS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { workspaces: true },
    });

    if (!user || user.workspaces.length === 0) {
      return new NextResponse("Not Found: User or Workspace does not exist", { status: 404 });
    }

    const workspace = user.workspaces[0];

    const body = await req.json();
    const validation = CampaignSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { name, goal, targetAudience } = validation.data;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        goal,
        targetAudience,
        workspaceId: workspace.id,
      },
    });

    return NextResponse.json(campaign);
  } catch (error: unknown) {
    console.error("[CAMPAIGNS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

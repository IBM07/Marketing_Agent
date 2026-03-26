import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Helper function to get or create User and their default workspace
async function getOrCreateUserAndWorkspace() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    throw new Error("Unauthorized");
  }

  const primaryEmail = user.emailAddresses[0]?.emailAddress;

  // Upsert user
  const dbUser = await prisma.user.upsert({
    where: { clerkId: userId },
    update: { email: primaryEmail },
    create: { clerkId: userId, email: primaryEmail },
  });

  // Check if they have a workspace
  let workspace = await prisma.workspace.findFirst({
    where: { userId: dbUser.id },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: `${user.firstName || 'My'} Workspace`,
        userId: dbUser.id,
      },
    });
  }

  return { user: dbUser, workspace };
}

export async function GET() {
  try {
    const { workspace } = await getOrCreateUserAndWorkspace();

    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (error: unknown) {
    console.error("[CAMPAIGNS_GET]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { workspace } = await getOrCreateUserAndWorkspace();
    const body = await req.json();
    const { name, goal, targetAudience } = body;

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

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
    if (error instanceof Error && error.message === "Unauthorized") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}

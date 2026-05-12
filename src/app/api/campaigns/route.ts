import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimiter } from "@/lib/rate-limit";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, NotFoundError, RateLimitError, ValidationError } from "@/lib/errors";

const CampaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  goal: z.string().max(2000, "Goal must be less than 2000 characters").optional(),
  targetAudience: z.string().max(2000, "Target audience must be less than 2000 characters").optional(),
});

const UpdateCampaignSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "PAUSED"]).optional(),
  name: z.string().max(100).optional(),
  goal: z.string().max(2000).optional(),
  targetAudience: z.string().max(2000).optional(),
});

export const GET = apiHandler(async (req: Request) => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    throw new NotFoundError("User or Workspace does not exist");
  }

  const workspace = user.workspaces[0];

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "20"));
  const skip = (page - 1) * limit;

  const campaigns = await prisma.campaign.findMany({
    where: { 
      workspaceId: workspace.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  const total = await prisma.campaign.count({
    where: { 
      workspaceId: workspace.id,
      deletedAt: null,
    },
  });

  return NextResponse.json({
    data: campaigns,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  });
});

export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  const rateLimit = rateLimiter.check(userId, 20, 60000); // 20 requests/minute per user as per spec
  if (!rateLimit.success) {
    throw new RateLimitError();
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    throw new NotFoundError("User or Workspace does not exist");
  }

  const workspace = user.workspaces[0];

  const body = await req.json();
  const validation = CampaignSchema.safeParse(body);

  if (!validation.success) {
    throw new ValidationError("Validation failed", "VALIDATION_ERROR");
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
});

export const PATCH = apiHandler(async (req: Request) => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    throw new NotFoundError("User or Workspace does not exist");
  }

  const workspace = user.workspaces[0];

  const body = await req.json();
  const validation = UpdateCampaignSchema.safeParse(body);

  if (!validation.success) {
    throw new ValidationError("Validation failed");
  }

  const { id, ...updateData } = validation.data;

  const existingCampaign = await prisma.campaign.findUnique({
    where: { id },
  });

  if (!existingCampaign || existingCampaign.workspaceId !== workspace.id || existingCampaign.deletedAt) {
    throw new NotFoundError("Campaign not found");
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(campaign);
});

export const DELETE = apiHandler(async (req: Request) => {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    throw new NotFoundError("User or Workspace does not exist");
  }

  const workspace = user.workspaces[0];

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    throw new ValidationError("Campaign ID is required");
  }

  const existingCampaign = await prisma.campaign.findUnique({
    where: { id },
  });

  if (!existingCampaign || existingCampaign.workspaceId !== workspace.id || existingCampaign.deletedAt) {
    throw new NotFoundError("Campaign not found");
  }

  await prisma.campaign.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true, message: "Campaign deleted" });
});

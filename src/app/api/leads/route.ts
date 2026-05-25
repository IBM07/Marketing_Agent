import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

const CreateLeadSchema = z.object({
  email: z.string().email("A valid email is required"),
  companyName: z.string().max(200).optional().default("Unknown"),
  prospectName: z.string().max(200).optional().default("Prospect"),
  phone: z.string().max(50).optional(),
  role: z.string().max(100).optional().default("Unknown"),
  scrapedFromUrl: z.string().url().optional().default("manual"),
});

const UpdateLeadSchema = z.object({
  companyName: z.string().max(200).optional(),
  prospectName: z.string().max(200).optional(),
  phone: z.string().max(50).optional().nullable(),
  role: z.string().max(100).optional(),
  isEnriched: z.boolean().optional(),
});

async function getWorkspaceForUser(clerkUserId: string) {
  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { workspaces: true },
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
      include: { workspaces: true },
    });
  } else if (user.workspaces.length === 0) {
    const clerkUser = await currentUser();
    const newWorkspace = await prisma.workspace.create({
      data: {
        name: `${clerkUser?.firstName || "My"} Workspace`,
        userId: user.id,
      },
    });
    user.workspaces = [newWorkspace];
  }

  return user.workspaces[0];
}

// GET /api/leads — List all leads for user's workspace (paginated)
export const GET = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const workspace = await getWorkspaceForUser(userId);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";

  const where = {
    workspaceId: workspace.id,
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { companyName: { contains: search, mode: "insensitive" as const } },
            { prospectName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        companyName: true,
        prospectName: true,
        phone: true,
        role: true,
        scrapedFromUrl: true,
        isEnriched: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { emailLogs: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({
    data: leads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/leads — Manually create a lead
export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const workspace = await getWorkspaceForUser(userId);

  const body = await req.json();
  const validation = CreateLeadSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError("Validation failed");
  }

  const { email, companyName, prospectName, phone, role, scrapedFromUrl } =
    validation.data;

  // Upsert to handle re-adding existing leads gracefully
  const lead = await prisma.lead.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: email.trim().toLowerCase(),
      },
    },
    update: {
      companyName: companyName !== "Unknown" ? companyName : undefined,
      prospectName: prospectName !== "Prospect" ? prospectName : undefined,
      phone: phone || undefined,
      role: role !== "Unknown" ? role : undefined,
    },
    create: {
      workspaceId: workspace.id,
      email: email.trim().toLowerCase(),
      companyName: companyName || "Unknown",
      prospectName: prospectName || "Prospect",
      phone: phone || null,
      role: role || "Unknown",
      scrapedFromUrl: scrapedFromUrl || "manual",
    },
  });

  return NextResponse.json(lead, { status: 201 });
});

// PATCH /api/leads?id=xxx — Update a lead
export const PATCH = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const workspace = await getWorkspaceForUser(userId);

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("id");
  if (!leadId) throw new ValidationError("Lead ID is required");

  const body = await req.json();
  const validation = UpdateLeadSchema.safeParse(body);
  if (!validation.success) throw new ValidationError("Validation failed");

  const existingLead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existingLead || existingLead.workspaceId !== workspace.id) {
    throw new NotFoundError("Lead not found");
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: validation.data,
  });

  return NextResponse.json(lead);
});

// DELETE /api/leads?id=xxx — Delete a lead
export const DELETE = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();

  const workspace = await getWorkspaceForUser(userId);

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("id");
  if (!leadId) throw new ValidationError("Lead ID is required");

  const existingLead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existingLead || existingLead.workspaceId !== workspace.id) {
    throw new NotFoundError("Lead not found");
  }

  await prisma.lead.delete({ where: { id: leadId } });

  return NextResponse.json({ success: true, message: "Lead deleted" });
});

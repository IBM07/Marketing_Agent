/**
 * src/lib/workspace.ts
 *
 * Shared utility for resolving the authenticated user's workspace.
 *
 * Guarantees:
 *   - A User record exists in the DB (creates one via Clerk if not found)
 *   - The User has at least one Workspace (creates a default one if missing)
 *
 * Usage:
 *   const { user, workspace } = await getOrCreateWorkspace(userId);
 */

import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/errors";

/**
 * Ensures a User record and at least one Workspace exist for the given
 * Clerk user ID. Creates them on first call (e.g., right after sign-up
 * when the webhook hasn't fired yet, or in development environments).
 */
export async function getOrCreateWorkspace(clerkUserId: string) {
  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { workspaces: true },
  });

  if (!user) {
    // User doesn't exist in our DB yet — fetch from Clerk and provision
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
    // User exists but somehow has no workspace — create one
    const clerkUser = await currentUser();
    const newWorkspace = await prisma.workspace.create({
      data: {
        name: `${clerkUser?.firstName || "My"} Workspace`,
        userId: user.id,
      },
    });
    user.workspaces = [newWorkspace];
  }

  return { user, workspace: user.workspaces[0] };
}

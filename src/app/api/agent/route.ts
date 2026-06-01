import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/errors";
import { createAgentPlan } from "@/lib/agent/orchestrator";
import { searchWeb } from "@/lib/scraper/search";
import { extractLeadsFromUrl } from "@/lib/scraper/extractor";
import { getRateLimiter } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

/**
 * Ensures a user record exists in the database, creating one if needed.
 * Also ensures the user has at least one workspace.
 */
async function getOrCreateWorkspace(clerkUserId: string) {
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

  return { user, workspace: user.workspaces[0] };
}

export const POST = apiHandler(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }

  // Rate Limiting
  const rateLimiter = getRateLimiter();
  if (rateLimiter) {
    const { success } = await rateLimiter.limit(userId);
    if (!success) {
      throw new AppError(
        429,
        "Rate limit exceeded. Please wait a minute before trying again.",
        "RATE_LIMIT_ERROR"
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Invalid JSON payload");
  }

  const { prompt, workspaceId: requestedWorkspaceId } = body;
  if (!prompt || typeof prompt !== "string") {
    throw new ValidationError("A natural language 'prompt' is required");
  }

  logger.info(
    `[AGENT_ROUTE] Initiating agent for user: ${userId} with prompt: ${prompt}`
  );

  const { workspace } = await getOrCreateWorkspace(userId);
  // If user explicitly passes a workspaceId, validate it belongs to them
  const targetWorkspaceId = requestedWorkspaceId || workspace.id;

  try {
    // 1. Orchestration Phase
    const plan = await createAgentPlan(prompt);
    logger.info(`[AGENT_ROUTE] Plan generated: ${JSON.stringify(plan)}`);

    // 2. Search Phase — run ALL generated queries and merge results
    if (!plan.searchQueries || plan.searchQueries.length === 0) {
      throw new Error("Agent could not generate a valid search query.");
    }

    const allUrls = new Set<string>();
    for (const searchQuery of plan.searchQueries) {
      try {
        logger.info(`[AGENT_ROUTE] Running search query: "${searchQuery}"`);
        const foundUrls = await searchWeb(searchQuery, 100); // Pass all serper results through filters
        foundUrls.forEach(u => allUrls.add(u));
      } catch (searchErr) {
        logger.warn(`[AGENT_ROUTE] Search query failed, skipping: ${searchErr instanceof Error ? searchErr.message : String(searchErr)}`);
      }
    }
    const targetUrls = Array.from(allUrls).slice(0, 200); // Cap at 200 URLs for a larger lead pool

    logger.info(
      `[AGENT_ROUTE] Discovered ${targetUrls.length} unique target URLs: ${targetUrls.join(", ")}`
    );

    // 3. Scrape & Extract Phase — throttled to avoid rate limits
    // Process in batches of 10 to prevent overwhelming API key quotas
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 500;
    const extractionResults: PromiseSettledResult<Awaited<ReturnType<typeof extractLeadsFromUrl>>>[] = [];

    for (let i = 0; i < targetUrls.length; i += BATCH_SIZE) {
      const batch = targetUrls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((url) => extractLeadsFromUrl(url, plan.targetCriteria))
      );
      extractionResults.push(...batchResults);

      // Small delay between batches to let rate limits recover
      if (i + BATCH_SIZE < targetUrls.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    logger.info(`[AGENT_ROUTE] Extraction complete: ${extractionResults.filter(r => r.status === 'fulfilled' && r.value).length}/${targetUrls.length} URLs yielded data`);

    // 4. Persist Leads to Database (upsert to avoid duplicates)
    const savedLeads: { id: string; email: string; companyName: string }[] = [];
    const skippedLeads: string[] = [];

    for (let i = 0; i < extractionResults.length; i++) {
      const result = extractionResults[i];
      if (result.status !== "fulfilled" || !result.value) continue;

      const { data } = result.value;
      const scrapedFromUrl = targetUrls[i];

      // Safeguard against LLM hallucinations where data or data.contacts is missing/not an array
      if (!data || !Array.isArray(data.contacts)) {
        logger.warn(`[AGENT_ROUTE] Invalid extraction payload for ${scrapedFromUrl} - contacts missing or not an array`);
        continue;
      }

      for (const contact of data.contacts) {
        // Only persist leads with a valid email
        if (!contact.email || !contact.email.includes("@")) {
          skippedLeads.push(contact.email || "(no email)");
          continue;
        }

        try {
          const lead = await prisma.lead.upsert({
            where: {
              workspaceId_email: {
                workspaceId: targetWorkspaceId,
                email: contact.email.trim().toLowerCase(),
              },
            },
            update: {
              // Update enrichment data if we have better info now
              companyName:
                data.companyName !== "Unknown"
                  ? data.companyName
                  : undefined,
              prospectName:
                contact.name !== "Unknown" ? contact.name : undefined,
              phone: contact.phone || undefined,
              role: contact.role !== "Unknown" ? contact.role : undefined,
              updatedAt: new Date(),
            },
            create: {
              workspaceId: targetWorkspaceId,
              email: contact.email.trim().toLowerCase(),
              companyName: data.companyName || "Unknown",
              prospectName: contact.name || "Prospect",
              phone: contact.phone || null,
              role: contact.role || "Unknown",
              scrapedFromUrl,
            },
          });
          savedLeads.push({
            id: lead.id,
            email: lead.email,
            companyName: lead.companyName,
          });
        } catch (dbError) {
          // P2002 = unique constraint violation — lead already exists (race condition)
          if (typeof dbError === 'object' && dbError !== null && 'code' in dbError && dbError.code === "P2002") {
            skippedLeads.push(contact.email);
          } else {
            logger.error("[AGENT_ROUTE] Failed to upsert lead:", dbError);
          }
        }
      }
    }

    logger.info(
      `[AGENT_ROUTE] Saved ${savedLeads.length} leads, skipped ${skippedLeads.length}`
    );

    return NextResponse.json({
      success: true,
      plan,
      targetUrls,
      leadsExtracted: savedLeads.length,
      leadsSkipped: skippedLeads.length,
      leads: savedLeads,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    logger.error("[AGENT_ROUTE_CRITICAL_FAILURE]", error);
    throw new AppError(
      500,
      error instanceof Error ? error.message : "An unexpected error occurred during agent execution",
      "AGENT_GENERIC_ERROR"
    );
  }
});

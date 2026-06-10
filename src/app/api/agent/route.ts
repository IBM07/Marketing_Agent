import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { apiHandler } from "@/lib/api-handler";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/errors";
import { createAgentPlan } from "@/lib/agent/orchestrator";
import { searchWeb } from "@/lib/scraper/search";
import { extractLeadsFromUrl } from "@/lib/scraper/extractor";
import { validateLead } from "@/lib/agent/validator";
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

    // Store extraction results alongside the filtered text for later validation
    interface ExtractionEntry {
      result: Awaited<ReturnType<typeof extractLeadsFromUrl>>;
      filteredText: string;
    }
    const extractionEntries: ExtractionEntry[] = [];

    for (let i = 0; i < targetUrls.length; i += BATCH_SIZE) {
      const batch = targetUrls.slice(i, i + BATCH_SIZE);
      const batchSettled = await Promise.allSettled(
        batch.map((url) => extractLeadsFromUrl(url, plan.targetCriteria))
      );

      for (const settled of batchSettled) {
        if (settled.status === "fulfilled" && settled.value) {
          extractionEntries.push({
            result: settled.value,
            // FIX 3 (part of FIX 2): use the actual filtered text returned by extractor
            filteredText: settled.value.filteredText ?? "",
          });
        } else {
          extractionEntries.push({ result: null, filteredText: "" });
        }
      }

      // Small delay between batches to let rate limits recover
      if (i + BATCH_SIZE < targetUrls.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const extractionResults = extractionEntries.map((e) => ({
      status: e.result ? "fulfilled" : "rejected",
      value: e.result,
    }));

    logger.info(`[AGENT_ROUTE] Extraction complete: ${extractionEntries.filter(e => e.result).length}/${targetUrls.length} URLs yielded data`);

    // 4. Persist Leads to Database (upsert to avoid duplicates)
    const savedLeads: { id: string; email: string; companyName: string; validated?: boolean }[] = [];
    const skippedLeads: string[] = [];

    // Collect (leadId, sourceUrl, filteredText) tuples for batch validation
    // FIX 3: Store the pre-filtered text so the background task doesn't need to re-fetch raw HTML
    const validationQueue: { leadId: string; sourceUrl: string; filteredText: string }[] = [];

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

          // Queue for 3-agent validation (one entry per unique URL, not per contact)
          if (!validationQueue.some((v) => v.sourceUrl === scrapedFromUrl)) {
            // FIX 3: pass the pre-filtered text extracted earlier
            validationQueue.push({
              leadId: lead.id,
              sourceUrl: scrapedFromUrl,
              filteredText: extractionEntries[i]?.filteredText ?? "",
            });
          }
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

    // ---------------------------------------------------------------------------
    // 5. 3-Agent Validation (fire-and-forget, non-blocking)
    // We kick off validation in the background so the response is not delayed.
    // Validation fetches the live page text from scrapedFromUrl, then runs all
    // 3 agents (criteria / intent / quality) with citation verification.
    // ---------------------------------------------------------------------------
    logger.info(`[AGENT_ROUTE] Queuing 3-agent validation for ${validationQueue.length} unique URLs`);

    // Async IIFE — intentionally not awaited so the HTTP response returns fast
    void (async () => {
      for (const entry of validationQueue) {
        try {
          // FIX 3: Use the pre-filtered text already extracted during scraping.
          // This avoids re-fetching raw HTML (20–100k chars) and sending it to
          // LLMs, which was the root cause of Groq 413 and Gemini 429 errors.
          const decision = await validateLead(
            entry.filteredText,
            entry.sourceUrl,
            plan.targetCriteria
          );

          // FIX 6: If all AI providers were exhausted, don't treat as rejection
          if ((decision as { crashed?: boolean }).crashed) {
            logger.warn(
              `[AGENT_ROUTE] All agents rate-limited for ${entry.sourceUrl} — skipping, not rejecting`
            );
            // Leave isEnriched=false; lead will stay pending for a future retry
          } else if (decision.approved) {
            await prisma.lead.updateMany({
              where: { scrapedFromUrl: entry.sourceUrl, workspaceId: targetWorkspaceId },
              data: { isEnriched: true, updatedAt: new Date() },
            });
            logger.info(
              `[AGENT_ROUTE] 3-agent validation APPROVED ${entry.sourceUrl} — isEnriched=true set for all matching leads`
            );
          } else {
            logger.info(
              `[AGENT_ROUTE] 3-agent validation REJECTED ${entry.sourceUrl} — score: ${decision.finalScore.toFixed(2)}, votes: [${decision.votes.map((v) => `${v.agentId}:${v.passed}`).join(", ")}]`
            );
          }
        } catch (valErr) {
          logger.error(
            `[AGENT_ROUTE] Validation background task failed for ${entry.sourceUrl}:`,
            valErr
          );
        }
        // FIX 7: 3-second cooldown between URLs to spread token consumption
        // across Gemini's 250k/min free-tier quota (prevents quota exhaustion on URL 3+)
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    })();

    logger.info(
      `[AGENT_ROUTE] Saved ${savedLeads.length} leads, skipped ${skippedLeads.length}. Validation queued for ${validationQueue.length} URLs.`
    );

    return NextResponse.json({
      success: true,
      plan,
      targetUrls,
      leadsExtracted: savedLeads.length,
      leadsSkipped: skippedLeads.length,
      leads: savedLeads,
      validationQueued: validationQueue.length,
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

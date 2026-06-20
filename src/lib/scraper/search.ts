import { logger } from "../logger";
import { redisConnection } from "../queue/index";

// ---------------------------------------------------------------------------
// Serper.dev Circuit Breaker
//
// Tracks consecutive Serper API failures in Redis. After 3 consecutive
// failures, the circuit "opens" and all calls immediately throw a
// descriptive error for 5 minutes — preventing cascading failures and
// wasted queue retries while the upstream service is down.
//
// Keys:
//   serper:circuit:failures  — counter of consecutive failures (no TTL)
//   serper:circuit:open      — flag set to "1" with 300s TTL when circuit opens
// ---------------------------------------------------------------------------

const CIRCUIT_FAILURE_KEY = "serper:circuit:failures";
const CIRCUIT_OPEN_KEY = "serper:circuit:open";
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_TTL_SECONDS = 300; // 5 minutes

export class SerperCircuitOpenError extends Error {
  constructor() {
    super(
      "Serper.dev circuit breaker is OPEN — too many consecutive failures. " +
        "The circuit will auto-reset in up to 5 minutes. Check Serper.dev status."
    );
    this.name = "SerperCircuitOpenError";
  }
}

/**
 * Check if the Serper circuit breaker is currently open.
 * Returns true if requests should be blocked.
 */
export async function isSerperCircuitOpen(): Promise<boolean> {
  try {
    const flag = await redisConnection.get(CIRCUIT_OPEN_KEY);
    return flag === "1";
  } catch {
    // If Redis itself is down, fail-open — allow requests through
    return false;
  }
}

/**
 * Record a Serper failure. If consecutive failures >= threshold,
 * open the circuit breaker.
 */
async function recordSerperFailure(): Promise<void> {
  try {
    const count = await redisConnection.incr(CIRCUIT_FAILURE_KEY);
    if (count >= CIRCUIT_FAILURE_THRESHOLD) {
      await redisConnection.set(CIRCUIT_OPEN_KEY, "1", "EX", CIRCUIT_OPEN_TTL_SECONDS);
      logger.warn(
        `[SERPER_CIRCUIT] Circuit OPENED after ${count} consecutive failures. ` +
          `Will auto-reset in ${CIRCUIT_OPEN_TTL_SECONDS}s.`
      );
    }
  } catch (err) {
    logger.warn(
      `[SERPER_CIRCUIT] Failed to record failure in Redis: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Record a Serper success and reset the failure counter.
 */
async function recordSerperSuccess(): Promise<void> {
  try {
    await redisConnection.del(CIRCUIT_FAILURE_KEY);
  } catch {
    // Best-effort — counter reset failure is non-critical
  }
}

/**
 * Checks whether a URL should be filtered out.
 * Blocks aggregators, CDNs, image files, social media, and generic listing pages.
 */
function isFilteredUrl(foundUrl: string): boolean {
  // Block all known aggregator platforms, social media, and JS-rendered SPAs
  const isAggregator = /(yelp\.com|tripadvisor\.com|facebook\.com|linkedin\.com|yellowpages\.com|instagram\.com|twitter\.com|x\.com|clutch\.co|goodfirms\.co|justdial\.com|sulekha\.com|indiamart\.com|quora\.com|reddit\.com|wikipedia\.org|amazon\.com|glassdoor\.com)/i.test(foundUrl);

  // Block job boards — includes all regional TLDs (pk.indeed.com, indeed.co.uk, etc.)
  // Evidence: pk.indeed.com → 403 on every URL; rozee.pk → 32 chars / 0 filtered
  const isJobBoard = /(indeed\.com|rozee\.pk|naukri\.com|bayt\.com|monster\.com|careerbuilder\.com|simplyhired\.com|ziprecruiter\.com|seek\.com|jora\.com|totaljobs\.com|reed\.co\.uk|stepstone\.de|apna\.co|timesjobs\.com|freshersworld\.com|cosmoquick\.com)/i.test(foundUrl);

  // Block hire/gig marketplaces (list freelancers but hide contact details behind login)
  // Evidence: contra.com, workhoppers.com, truelancer.com, bebee.com → 0 emails extracted
  const isHireMarketplace = /(contra\.com|workhoppers\.com|truelancer\.com|bebee\.com|codementor\.io|sortlist\.com|designrush\.com|techbehemoths\.com|bark\.com|thumbtack\.com|servicescape\.com|kolabtree\.com|gigster\.com|expert360\.com)/i.test(foundUrl);

  // Block training/course sites (not business leads)
  // Evidence: pnytrainings.com, onsite.pftpedu.org → scraped but yielded no emails
  const isTraining = /(pnytrainings\.com|pftpedu\.org|coursera\.org|udemy\.com|skillshare\.com|edx\.org|pluralsight\.com|codecademy\.com|w3schools\.com|geeksforgeeks\.org|tutorialspoint\.com)/i.test(foundUrl);

  // Block freelance marketplaces / SaaS platforms — uses freelancer\. (no .com suffix) to match ALL TLDs
  // Fixes: freelancer.pk and freelancer.co.za were passing through the old freelancer\.com pattern
  const isMarketplace = /(upwork\.com|fiverr\.com|freelancer\.|toptal\.com|twine\.net|guru\.com|peopleperhour\.com|99designs\.com|dribbble\.com|behance\.net|wise\.com|paypal\.com|stripe\.com|shopify\.com|wix\.com|squarespace\.com|wordpress\.com|medium\.com|hubspot\.com|mailchimp\.com|crunchbase\.com|g2\.com|capterra\.com|trustpilot\.com|producthunt\.com|angel\.co|wellfound\.com|techcrunch\.com)/i.test(foundUrl);

  // Block blog posts, registration/signup pages, hire paths, and job listing paths
  const isNonContactPath = /(\/blog\/|\/blog$|\/register|\/signup|\/sign-up|\/login|\/sign-in|\/docs\/|\/help\/|\/support\/|\/faq|\/careers|\/jobs|\/pricing|\/hire\/|\/job-search\/|\/jsearch\/|\/hirefreelancer\/|\/discover\?|\/people\/role\/)/i.test(foundUrl);

  // Block CDN image/asset URLs (these can't be lead pages)
  const isAsset = /\.(png|jpg|jpeg|gif|webp|svg|pdf|mp4|mp3|zip|css|js)(\?.*)?$/i.test(foundUrl);

  // Block search engine result pages and pagination
  const isSearchPage = /(\?q=|\?query=|\/page\/\d+|\/p\d+$|google\.com\/search|bing\.com\/search|duckduckgo\.com)/i.test(foundUrl);

  // Block CDN and static hosting subdomains
  const isCdn = /(cdn\.|static\.|img\.|images\.|assets\.|shgstatic\.com|cloudfront\.net|amazonaws\.com)/i.test(foundUrl);

  // Block Cloudflare email-protection redirect pages (no real content)
  const isEmailProtection = /\/cdn-cgi\/l\/email-protection/i.test(foundUrl);

  // Block content-only domains that will never contain B2B lead contact info.
  // These show up in Serper results but yield zero emails — just burned API credits.
  // Evidence: nasa.gov, youtube.com, podcasts.apple.com all appeared in logs for
  // nonsense prompts and legitimate prompts alike, producing zero leads every time.
  const isContentOnly = /(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|podcasts\.apple\.com|spotify\.com|soundcloud\.com|nasa\.gov|\.gov\/|\.mil\/|\.edu\/|arxiv\.org|nature\.com|sciencedirect\.com|springer\.com|wiley\.com|ncbi\.nlm\.nih\.gov|pubmed\.ncbi|researchgate\.net|academia\.edu|bbc\.com|bbc\.co\.uk|cnn\.com|nytimes\.com|washingtonpost\.com|theguardian\.com|reuters\.com|apnews\.com|forbes\.com|bloomberg\.com|wsj\.com|ft\.com|cnbc\.com|businessinsider\.com|vice\.com|buzzfeed\.com|pinterest\.com|tiktok\.com|snapchat\.com|whatsapp\.com|telegram\.org|discord\.com|slack\.com|zoom\.us|teams\.microsoft\.com|docs\.google\.com|drive\.google\.com|github\.com|gitlab\.com|bitbucket\.org|stackoverflow\.com|stackexchange\.com|archive\.org|web\.archive\.org)/i.test(foundUrl);

  return isAggregator || isJobBoard || isHireMarketplace || isTraining ||
    isMarketplace || isNonContactPath || isAsset || isSearchPage || isCdn || isEmailProtection || isContentOnly;
}

/**
 * Searches the web using Serper.dev Google Search API.
 * Returns a filtered array of scrapeable URLs directly — no markdown parsing needed.
 *
 * Replaces the old Jina AI (s.jina.ai) implementation.
 * Requires SERPER_API_KEY environment variable.
 *
 * Protected by a Redis-backed circuit breaker: after 3 consecutive
 * failures, all calls short-circuit for 5 minutes to prevent cascading
 * retries and wasted queue processing.
 */
export async function searchWeb(query: string, maxResults: number = 15): Promise<string[]> {
  // ── Circuit breaker gate ───────────────────────────────────────────
  const circuitOpen = await isSerperCircuitOpen();
  if (circuitOpen) {
    logger.warn(`[WEB_SEARCH] Circuit breaker OPEN — rejecting query: "${query}"`);
    throw new SerperCircuitOpenError();
  }

  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    logger.error("[WEB_SEARCH_ERROR] SERPER_API_KEY is not configured.");
    throw new Error("SERPER_API_KEY is not set. Cannot perform web search.");
  }

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 100, // Request maximum (100) results from Serper to maximize filtered lead pool
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Let the outer catch handle circuit breaker recording
      throw new Error(`Serper.dev search failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json() as {
      organic?: { link: string; title: string }[];
    };

    // ── Success — reset circuit breaker ─────────────────────────────
    await recordSerperSuccess();

    const rawResults = data.organic ?? [];
    const urls: string[] = [];
    const seen = new Set<string>();

    for (const result of rawResults) {
      if (urls.length >= maxResults) break;
      const url = result.link;
      if (url && !isFilteredUrl(url) && !seen.has(url)) {
        urls.push(url);
        seen.add(url);
      }
    }

    logger.info(`[WEB_SEARCH] Serper returned ${rawResults.length} results, ${urls.length} passed filter for query: "${query}"`);
    return urls;
  } catch (error) {
    // Only record failure if it's NOT already a circuit-open error
    if (!(error instanceof SerperCircuitOpenError)) {
      await recordSerperFailure();
    }
    logger.error("[WEB_SEARCH_ERROR]", error);
    throw new Error(`Web search failed for query: ${query}. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

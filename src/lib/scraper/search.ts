import { logger } from "../logger";

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

  return isAggregator || isJobBoard || isHireMarketplace || isTraining ||
    isMarketplace || isNonContactPath || isAsset || isSearchPage || isCdn || isEmailProtection;
}

/**
 * Searches the web using Serper.dev Google Search API.
 * Returns a filtered array of scrapeable URLs directly — no markdown parsing needed.
 *
 * Replaces the old Jina AI (s.jina.ai) implementation.
 * Requires SERPER_API_KEY environment variable.
 */
export async function searchWeb(query: string, maxResults: number = 15): Promise<string[]> {
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
        num: 20, // Request 20 results so filtering still yields enough scrapeable URLs
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper.dev search failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json() as {
      organic?: { link: string; title: string }[];
    };

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
    logger.error("[WEB_SEARCH_ERROR]", error);
    throw new Error(`Web search failed for query: ${query}. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

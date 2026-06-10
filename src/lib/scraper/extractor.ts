import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { extractContactSegments } from "./filter";
import { regexExtractContacts } from "./regex-extractor";
import { KeyRotationLLMClient, LeadExtractionPayload } from "../ai/rotation-client";
import { logger } from "../logger";

const llmClient = new KeyRotationLLMClient();

// ---------------------------------------------------------------------------
// Browserless fallback — fetches JS-rendered HTML via a headless Chromium
// instance (Browserless v2: ghcr.io/browserless/chromium).
// Returns raw HTML string on success, null if Browserless is not configured
// or the request fails for any reason.
// API reference: https://docs.browserless.io/rest-apis/content
// ---------------------------------------------------------------------------
async function fetchWithBrowserless(url: string): Promise<string | null> {
  const browserlessUrl = process.env.BROWSERLESS_URL;
  if (!browserlessUrl) return null;

  try {
    logger.info(`[BROWSERLESS] Attempting JS-render for ${url}`);
    // Browserless v2 uses /chromium/content (v1 used /content)
    const response = await fetch(`${browserlessUrl}/chromium/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        waitForTimeout: 2000,  // v2 uses waitForTimeout, not waitFor
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      logger.warn(`[BROWSERLESS] HTTP ${response.status} for ${url} — skipping`);
      return null;
    }

    const html = await response.text();
    logger.info(`[BROWSERLESS] Successfully fetched ${url} (${html.length} bytes)`);
    return html;
  } catch (err) {
    logger.warn(`[BROWSERLESS] Failed for ${url}:`, err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}

/** HTML tags whose content is always noise — never contains lead data. */
const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "img",
  "video",
  "audio",
  "canvas",
  "figure",
  "picture",
  "source",
  "track",
  "nav",
  "header",
  "footer",
  "aside",
  "[class*='cookie']",
  "[class*='banner']",
  "[class*='popup']",
  "[class*='modal']",
  "[id*='cookie']",
  "[id*='banner']",
  "[id*='popup']",
  "[id*='modal']",
];

/**
 * Fetches a URL, strips HTML noise with Cheerio, converts to Markdown via
 * node-html-markdown, then runs regex extraction.  If regex finds email
 * contacts the LLM call is skipped entirely (zero tokens used).
 * Otherwise falls back through Cerebras → Groq → Gemini.
 */
export async function extractLeadsFromUrl(
  url: string,
  instruction?: string
): Promise<{
  data: LeadExtractionPayload;
  rawMarkdownLength: number;
  filteredLength: number;
  filteredText: string; // FIX 2: expose the actual text so callers don't need to re-fetch
} | null> {
  try {
    // -----------------------------------------------------------------------
    // STEP 1: Fetch raw HTML
    // -----------------------------------------------------------------------
    const response = await fetch(url, {
      method: "GET",
      headers: {
        // Appear as a regular browser to avoid bot-detection rejections
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      // 5 second timeout — generous but won't stall the batch pipeline
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      logger.warn(`[EXTRACTION] HTTP ${response.status} for ${url} — skipping`);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      logger.info(
        `[EXTRACTION] Non-HTML content-type (${contentType}) for ${url} — skipping`
      );
      return null;
    }

    const rawHtml = await response.text();

    // -----------------------------------------------------------------------
    // STEP 2: Cheerio — remove noise elements, keep meaningful DOM
    // -----------------------------------------------------------------------
    const $ = cheerio.load(rawHtml);
    $(NOISE_SELECTORS.join(", ")).remove();

    // Grab the cleaned inner HTML of the body (or whole doc if no body)
    const cleanedHtml = $("body").html() ?? $.html();

    // -----------------------------------------------------------------------
    // STEP 3: Convert cleaned HTML → Markdown
    // FIX 1: Safety fallback — if NOISE_SELECTORS stripped everything (< 100
    // chars) fall back to the full raw HTML so SPA content is not lost.
    // -----------------------------------------------------------------------
    const htmlToConvert = cleanedHtml.trim().length < 100 ? rawHtml : cleanedHtml;
    const rawMarkdown = NodeHtmlMarkdown.translate(htmlToConvert);

    // -----------------------------------------------------------------------
    // STEP 4: Filter markdown down to contact-signal lines only
    // -----------------------------------------------------------------------
    let filteredText = extractContactSegments(rawMarkdown);

    logger.info(
      `[EXTRACTION] ${url} — raw: ${rawMarkdown.length} chars → filtered: ${filteredText.length} chars`
    );

    // -----------------------------------------------------------------------
    // STEP 4b: Browserless fallback for JS-rendered SPAs
    // Triggered when the standard fetch yields < 50 chars of contact-signal
    // text — a strong indicator the page body was empty (React/Vue SPA).
    // -----------------------------------------------------------------------
    if (filteredText.length < 50) {
      const browserlessHtml = await fetchWithBrowserless(url);
      if (browserlessHtml) {
        const $bl = cheerio.load(browserlessHtml);
        $bl(NOISE_SELECTORS.join(", ")).remove();
        const cleanedBrowserlessHtml = $bl("body").html() ?? $bl.html();
        // FIX 1 (Browserless path): same safety fallback as above
        const blHtmlToConvert = cleanedBrowserlessHtml.trim().length < 100
          ? browserlessHtml
          : cleanedBrowserlessHtml;
        const browserlessMarkdown = NodeHtmlMarkdown.translate(blHtmlToConvert);
        const browserlessFiltered = extractContactSegments(browserlessMarkdown);

        logger.info(
          `[BROWSERLESS] ${url} — raw: ${browserlessMarkdown.length} chars → filtered: ${browserlessFiltered.length} chars`
        );

        if (browserlessFiltered.length > filteredText.length) {
          filteredText = browserlessFiltered;
        }
      }
    }

    if (filteredText.length < 10) {
      logger.info(
        `[EXTRACTION] Skipping ${url} — no contact signals found after filtering (including Browserless fallback)`
      );
      return null;
    }

    // -----------------------------------------------------------------------
    // STEP 5: Regex extraction — fast, free, zero tokens
    // -----------------------------------------------------------------------
    const regexResult = regexExtractContacts(filteredText);

    if (regexResult.foundContacts) {
      logger.info(
        `[EXTRACTION] Regex extracted ${regexResult.emails.length} email(s) from ${url} — LLM skipped`
      );

      // Build a structured payload directly from regex results
      const contacts = regexResult.emails.map((email) => ({
        name: "Unknown",
        email,
        phone: null as string | null,
        role: "Unknown",
      }));

      // Attach any phones found to the first contact (best-effort enrichment)
      if (regexResult.phones.length > 0 && contacts.length > 0) {
        contacts[0].phone = regexResult.phones[0];
      }

      return {
        data: {
          companyName: new URL(url).hostname.replace(/^www\./, ""),
          summary: "Extracted via local regex (no LLM required).",
          contacts,
        },
        rawMarkdownLength: rawMarkdown.length,
        filteredLength: filteredText.length,
        filteredText, // FIX 2: return actual text
      };
    }

    // -----------------------------------------------------------------------
    // STEP 6: LLM fallback — Cerebras → Groq → Gemini
    // -----------------------------------------------------------------------
    const structurePrompt = `
      You are an elite B2B data extraction agent. Parse the following unstructured markdown text and extract all leads matching the instruction.
      
      Instruction: "${instruction || "Isolate all founders, executive leads, and distinct business contact emails."}"
      
      RULES:
      - Extract EVERY email address you can find in the text. Do NOT skip any.
      - If you find an email but no name, use "Unknown" as the name.
      - If you find an email but no role, use "Unknown" as the role.
      - Do NOT invent or hallucinate emails that are not in the text.
      - Return an empty contacts array if there are genuinely no emails in the text.
      
      Output format must strictly match this exact JSON schema:
      {
        "companyName": "Standard Company Name or Unknown",
        "summary": "A concise one-sentence description of what this company does.",
        "contacts": [
          {
            "name": "Full Name",
            "email": "Valid email address (or null if not found)",
            "phone": "Phone number (or null if not found)",
            "role": "Exact role title (or Unknown)"
          }
        ]
      }
    `;

    // Primary: Cerebras (1M tokens/day free tier)
    let result = await llmClient.extractWithCerebras(structurePrompt, filteredText);

    if (!result) {
      logger.warn("[EXTRACTION] Cerebras failed, falling back to Groq");
      result = await llmClient.extractWithGroq(structurePrompt, filteredText);
    }

    if (!result) {
      logger.warn("[EXTRACTION] Groq failed, falling back to Gemini");
      result = await llmClient.extractWithGemini(structurePrompt, filteredText);
    }

    return {
      data: result,
      rawMarkdownLength: rawMarkdown.length,
      filteredLength: filteredText.length,
      filteredText, // FIX 2: return actual text
    };
  } catch (error: unknown) {
    // AbortError = request timed out — expected for slow/blocked sites
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn(`[EXTRACTION] Timeout fetching ${url} — skipping`);
    } else {
      logger.error(`[EXTRACTION_ERROR] Failed on ${url}:`, error);
    }
    return null;
  }
}

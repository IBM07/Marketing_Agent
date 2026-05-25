/**
 * Fast, zero-cost regex extraction of contact data from scraped page text.
 *
 * This runs BEFORE any LLM call. If emails/phones are found, the LLM step
 * is skipped entirely — saving tokens, latency, and rate-limit quota.
 *
 * False-positive guards:
 *  - Image file extensions (.png, .jpg, .gif, etc.) are filtered out.
 *  - Common no-reply / generic sender domains are excluded.
 *  - Structural CSS/JS artifacts (e.g., webpack chunk hashes) are dropped.
 */

export interface RegexExtractResult {
  emails: string[];
  phones: string[];
  /** True when at least one email was found — caller can skip LLM. */
  foundContacts: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Domains that virtually never belong to a real decision maker. */
const GENERIC_DOMAINS = new Set([
  'example.com',
  'example.org',
  'test.com',
  'domain.com',
  'email.com',
  'yourwebsite.com',
  'sentry.io',
  'w3.org',
  'schema.org',
  'google.com',
  'googleapis.com',
  'cloudflare.com',
  'amazonaws.com',
]);

/** File extensions that appear after the @ in image/asset URLs, not emails. */
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff?|avif)$/i;

/** Standard RFC-5321-ish email pattern. */
const EMAIL_REGEX =
  /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;

/**
 * International phone pattern — matches:
 *  +1 (800) 555-1234 | +44 20 7946 0958 | 9876543210 | (03) 9123 4567
 * Minimum 7 digits after stripping separators.
 */
const PHONE_REGEX =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.\-]?){1,4}\d{3,4}[\s.\-]?\d{3,4}/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  const lower = email.toLowerCase();

  // Drop image-extension false positives (e.g., hero@2x.png)
  const domain = lower.split('@')[1] ?? '';
  if (IMAGE_EXTENSIONS.test(domain)) return false;

  // Drop known generic / placeholder domains
  if (GENERIC_DOMAINS.has(domain)) return false;

  // Drop webpack/build artifact hashes (emails that are clearly hex strings)
  const local = lower.split('@')[0];
  if (/^[a-f0-9]{8,}$/.test(local)) return false;

  // Minimum TLD length of 2
  const tldMatch = domain.match(/\.([a-z]{2,})$/);
  if (!tldMatch) return false;

  return true;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function hasEnoughDigits(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extracts emails and phone numbers from raw text using pure regex.
 * Deduplicates results and applies false-positive filters.
 *
 * @param text  Plain text (or lightly cleaned HTML-to-text) from a scraped page.
 * @returns     Deduplicated arrays of emails and phones, plus a `foundContacts` flag.
 */
export function regexExtractContacts(text: string): RegexExtractResult {
  if (!text || text.trim().length === 0) {
    return { emails: [], phones: [], foundContacts: false };
  }

  // --- Emails ---
  const rawEmails = text.match(EMAIL_REGEX) ?? [];
  const emails = [
    ...new Set(
      rawEmails
        .map((e) => e.toLowerCase().trim())
        .filter(isValidEmail),
    ),
  ];

  // --- Phones ---
  const rawPhones = text.match(PHONE_REGEX) ?? [];
  const phones = [
    ...new Set(
      rawPhones
        .map(normalizePhone)
        .filter(hasEnoughDigits),
    ),
  ];

  return {
    emails,
    phones,
    foundContacts: emails.length > 0,
  };
}

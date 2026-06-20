/**
 * src/lib/scraper/email-validator.ts
 *
 * Email MX validation + disposable domain filter.
 *
 * Called in the extraction worker BEFORE persisting a lead to the database.
 * If the email domain has no MX records or is a known disposable provider,
 * the lead is silently dropped — keeping the database clean and preventing
 * bounce-rate damage when campaigns are sent.
 *
 * DNS lookups are cached in-memory for the lifetime of the worker process
 * to avoid hammering resolvers on large batches.
 */

import dns from "dns/promises";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Disposable / temporary email domains
// ---------------------------------------------------------------------------

const DISPOSABLE_DOMAINS = new Set([
  // Major disposable providers
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "10minutemail.com",
  "trashmail.com",
  "sharklasers.com",
  "grr.la",
  "spam4.me",
  "getairmail.com",
  "filzmail.com",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.de",
  "temp-mail.org",
  "fakeinbox.com",
  "tempail.com",
  "tempr.email",
  "discard.email",
  "mailcatch.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "harakirimail.com",
  "jetable.org",
  "nospam.ze.tc",
  "mailnull.com",
  "spamfree24.org",
  "trashymail.com",
  "mytemp.email",
  "tempinbox.com",
  "throwam.com",
  "getnada.com",
  "guerrillamail.biz",
  "spamgourmet.com",
  "mailexpire.com",
  "inboxbear.com",
  "crazymailing.com",
]);

// ---------------------------------------------------------------------------
// In-memory MX result cache (domain → isValid)
// Avoids redundant DNS lookups when multiple contacts share the same domain.
// Persists for the lifetime of the worker process.
// ---------------------------------------------------------------------------
const mxCache = new Map<string, boolean>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EmailValidation {
  email: string;
  isValid: boolean;
  confidence: number;
  reason: string;
}

/**
 * Validates an email address by:
 *   1. Checking format validity
 *   2. Rejecting known disposable domains
 *   3. Performing a DNS MX lookup to confirm the domain can receive mail
 *
 * Returns a structured result with confidence score and human-readable reason.
 */
export async function validateEmail(
  email: string
): Promise<EmailValidation> {
  // Format check
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return { email, isValid: false, confidence: 0, reason: "Invalid format" };
  }

  // Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    logger.info(`[EMAIL_VALIDATOR] Rejected disposable domain: ${domain}`);
    return {
      email,
      isValid: false,
      confidence: 0.1,
      reason: "Disposable domain",
    };
  }

  // Check cache first
  if (mxCache.has(domain)) {
    const cached = mxCache.get(domain)!;
    return cached
      ? { email, isValid: true, confidence: 0.95, reason: "MX verified (cached)" }
      : { email, isValid: false, confidence: 0.4, reason: "No MX records (cached)" };
  }

  // DNS MX lookup
  try {
    const records = await dns.resolveMx(domain);
    const hasMx = records.length > 0;
    mxCache.set(domain, hasMx);

    if (hasMx) {
      return { email, isValid: true, confidence: 0.95, reason: "MX verified" };
    }
    logger.info(`[EMAIL_VALIDATOR] No MX records for domain: ${domain}`);
    return { email, isValid: false, confidence: 0.4, reason: "No MX records" };
  } catch {
    // DNS failure — domain probably doesn't exist
    mxCache.set(domain, false);
    logger.info(`[EMAIL_VALIDATOR] DNS lookup failed for domain: ${domain}`);
    return {
      email,
      isValid: false,
      confidence: 0.3,
      reason: "DNS lookup failed",
    };
  }
}

/**
 * Minimum confidence threshold for a lead to be persisted.
 * Emails below this threshold are silently dropped.
 */
export const MIN_EMAIL_CONFIDENCE = 0.60;

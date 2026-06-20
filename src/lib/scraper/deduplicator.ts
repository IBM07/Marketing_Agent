/**
 * src/lib/scraper/deduplicator.ts
 *
 * Company-level deduplication using fuzzy name matching.
 *
 * When multiple URLs from the same company are scraped, they often produce
 * slightly different company names ("Acme Inc", "Acme Incorporated",
 * "ACME Corp"). Without deduplication, the same company appears as
 * multiple leads — inflating counts and confusing campaign targeting.
 *
 * This module normalizes company names and uses Jaro-Winkler string
 * similarity to detect near-duplicates. No npm dependencies required.
 */

import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Company name normalization
// ---------------------------------------------------------------------------

/**
 * Strips common business suffixes, normalizes whitespace and casing.
 * Examples:
 *   "Acme, Inc."           → "acme"
 *   "ACME Incorporated"    → "acme"
 *   "Acme Solutions LLC"   → "acme solutions"
 *   "  The  Acme  Corp  "  → "acme"
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes (order matters — longest first)
    .replace(
      /\b(incorporated|corporation|company|international|technologies|solutions|enterprises|consulting|services|associates|partners|group|limited|holdings)\b/g,
      ""
    )
    .replace(/\b(inc\.?|corp\.?|ltd\.?|llc\.?|llp\.?|pvt\.?|co\.?|plc\.?|gmbh|s\.?a\.?|b\.?v\.?|ag)\b/g, "")
    // Remove leading "The"
    .replace(/^the\s+/, "")
    // Remove all punctuation
    .replace(/[.,;:!?'"()\-\/\\@#$%^&*+=\[\]{}|~`]/g, "")
    // Collapse multiple spaces to one
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Jaro-Winkler similarity (pure TypeScript, no dependencies)
// ---------------------------------------------------------------------------

/**
 * Jaro similarity between two strings.
 * Returns a value between 0.0 (no similarity) and 1.0 (identical).
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);

  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Jaro-Winkler similarity. Adds a prefix bonus on top of Jaro for strings
 * that share a common prefix (up to 4 characters).
 *
 * @returns Value between 0.0 and 1.0. Higher = more similar.
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);

  // Common prefix (max 4 characters)
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  // Winkler scaling factor (standard = 0.1)
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** Similarity threshold: > 0.90 = same company */
export const DEDUP_THRESHOLD = 0.90;

/**
 * Checks whether a company name is a near-duplicate of any name in the
 * provided set. Uses normalized Jaro-Winkler comparison.
 *
 * @param newName    The new company name to check.
 * @param existing   Set of already-seen normalized company names.
 * @returns          True if a near-duplicate was found (should skip this lead).
 */
export function isDuplicateCompany(
  newName: string,
  existing: Set<string>
): boolean {
  const normalized = normalizeCompanyName(newName);
  if (!normalized || normalized === "unknown") return false;

  for (const name of existing) {
    if (name === normalized) {
      logger.info(`[DEDUP] Exact duplicate: "${newName}" matches "${name}"`);
      return true;
    }
    const similarity = jaroWinklerSimilarity(normalized, name);
    if (similarity > DEDUP_THRESHOLD) {
      logger.info(
        `[DEDUP] Fuzzy duplicate: "${newName}" ↔ "${name}" (similarity: ${similarity.toFixed(3)})`
      );
      return true;
    }
  }

  return false;
}

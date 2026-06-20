/**
 * Email quota constants and helpers.
 *
 * The daily email limit is a single configurable ceiling for all users.
 * Set the DAILY_EMAIL_LIMIT environment variable to override the default.
 * This is an open-source, self-hosted product — users control their own
 * mail provider (SMTP or Resend via .env) and their own throughput.
 */

/** Fallback daily email cap when DAILY_EMAIL_LIMIT is not set in env. */
const DEFAULT_LIMIT = 1000;

/**
 * Returns the effective daily email limit.
 * Reads from DAILY_EMAIL_LIMIT env var; falls back to 1000.
 * Must be a positive integer to be accepted.
 */
export function getDailyEmailLimit(): number {
  const envLimit = process.env.DAILY_EMAIL_LIMIT;
  if (envLimit) {
    const parsed = parseInt(envLimit, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_LIMIT;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

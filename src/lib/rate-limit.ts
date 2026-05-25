import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Upstash Redis Rate Limiter ───────────────────────────────────────────────
// Used for heavy AI/agent operations that need distributed tracking across
// serverless instances. Returns null if Upstash is not configured (degrades
// gracefully — no crash, just no rate limiting).
export const getRateLimiter = () => {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    console.warn(
      "[RATE_LIMIT] Upstash Redis is not configured. Agent rate limiting is disabled."
    );
    return null;
  }

  const redis = Redis.fromEnv();

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
  });
};

// ─── In-Memory Rate Limiter ───────────────────────────────────────────────────
// Lightweight token-bucket for protecting standard API routes (campaigns, AI
// generate, send). Works without external dependencies. Resets on cold start,
// which is acceptable for serverless environments at this scale.
interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};

export const rateLimiter = {
  /**
   * @param key       Unique identifier (e.g., userId)
   * @param maxCalls  Maximum allowed calls within the window
   * @param windowMs  Time window in milliseconds
   */
  check(
    key: string,
    maxCalls: number,
    windowMs: number
  ): { success: boolean; remaining: number } {
    const now = Date.now();
    const record = store[key];

    if (!record || now > record.resetAt) {
      store[key] = { count: 1, resetAt: now + windowMs };
      return { success: true, remaining: maxCalls - 1 };
    }

    if (record.count >= maxCalls) {
      return { success: false, remaining: 0 };
    }

    record.count += 1;
    return { success: true, remaining: maxCalls - record.count };
  },
};

export class RateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();

  check(id: string, limit: number, windowMs: number): { success: boolean; limit: number; remaining: number; reset: number } {
    const now = Date.now();
    const windowStart = now - (now % windowMs);
    const key = `${id}:${windowStart}`;

    let record = this.cache.get(key);
    
    // Cleanup old entries occasionally (1% chance per check)
    if (Math.random() < 0.01) {
      for (const [k, v] of this.cache.entries()) {
        if (v.resetTime < now) {
          this.cache.delete(k);
        }
      }
    }

    if (!record || record.resetTime < now) {
      record = { count: 1, resetTime: windowStart + windowMs };
      this.cache.set(key, record);
      return { success: true, limit, remaining: limit - 1, reset: record.resetTime };
    }

    record.count++;
    this.cache.set(key, record);

    if (record.count > limit) {
      return { success: false, limit, remaining: 0, reset: record.resetTime };
    }

    return { success: true, limit, remaining: limit - record.count, reset: record.resetTime };
  }
}

export const rateLimiter = new RateLimiter();

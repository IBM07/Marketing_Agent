import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../rate-limit';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests under the limit', () => {
    const result = limiter.check('test-user', 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block requests over the limit', () => {
    limiter.check('test-user', 2, 60000);
    limiter.check('test-user', 2, 60000);
    const result = limiter.check('test-user', 2, 60000);
    
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after the window passes', () => {
    limiter.check('test-user', 1, 60000);
    let result = limiter.check('test-user', 1, 60000);
    expect(result.success).toBe(false);

    vi.advanceTimersByTime(60001);

    result = limiter.check('test-user', 1, 60000);
    expect(result.success).toBe(true);
  });
});
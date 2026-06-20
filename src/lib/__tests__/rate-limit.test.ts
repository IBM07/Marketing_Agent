import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimiter } from '../rate-limit';

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests under the limit', () => {
    const result = rateLimiter.check('test-user-rl1', 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block requests over the limit', () => {
    rateLimiter.check('test-user-rl2', 2, 60000);
    rateLimiter.check('test-user-rl2', 2, 60000);
    const result = rateLimiter.check('test-user-rl2', 2, 60000);
    
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after the window passes', () => {
    rateLimiter.check('test-user-rl3', 1, 60000);
    let result = rateLimiter.check('test-user-rl3', 1, 60000);
    expect(result.success).toBe(false);

    vi.advanceTimersByTime(60001);

    result = rateLimiter.check('test-user-rl3', 1, 60000);
    expect(result.success).toBe(true);
  });
});
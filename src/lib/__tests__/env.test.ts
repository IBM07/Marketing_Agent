import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Environment Validation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should parse valid environment variables', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test';
    process.env.CLERK_SECRET_KEY = 'sk_test';
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.RESEND_API_KEY = 're_test';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test';
    process.env.RESEND_FROM_EMAIL = 'test@example.com';

    const { env } = await import('../env');
    expect(env.DATABASE_URL).toBe('postgresql://localhost:5432');
  });

  it('should throw an error for invalid environment variables', async () => {
    process.env.DATABASE_URL = 'invalid-url';
    
    await expect(import('../env')).rejects.toThrow('Invalid URL');
  });
});
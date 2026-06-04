import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  GROQ_API_KEY: z.string().startsWith('gsk_'),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  CEREBRAS_API_KEY: z.string().min(1).optional(),
  SERPER_API_KEY: z.string().min(1, 'SERPER_API_KEY is required for the scraper to function'),
  // Plural comma-separated pools — used by KeyRotationLLMClient for multi-key rotation
  CEREBRAS_API_KEYS: z.string().min(1).optional(),
  GROQ_API_KEYS: z.string().min(1).optional(),
  GEMINI_API_KEYS: z.string().min(1).optional(),
  // [OPTIONAL] Browserless Chrome instance for JS-rendered page crawling
  // Deploy: docker run -p 3000:3000 ghcr.io/browserless/chrome
  BROWSERLESS_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);

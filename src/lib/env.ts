import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  GROQ_API_KEY: z.string().startsWith('gsk_'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
});

export const env = envSchema.parse(process.env);

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  discoveryQueue,
  extractionQueue,
  validationQueue,
  dlq,
} from '@/lib/queue/index';
import { isSerperCircuitOpen } from '@/lib/scraper/search';

/**
 * GET /api/health
 *
 * Comprehensive system health check for HyperDrive AI.
 *
 * Returns the status of every critical subsystem so users running
 * locally can quickly diagnose their setup. This is the "is my
 * local setup working?" page for every new contributor.
 *
 * Subsystems checked:
 *   1. Database (PostgreSQL via Prisma)
 *   2. BullMQ queue depths (discovery, extraction, validation, DLQ)
 *   3. Serper.dev circuit breaker state
 *   4. LLM provider configuration (Cerebras, Groq, Gemini)
 *   5. Browserless Chrome configuration
 *   6. Redis connectivity (via BullMQ queue ping)
 */
export async function GET() {
  let dbStatus: 'connected' | 'error' = 'error';
  let redisStatus: 'connected' | 'error' = 'error';
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';

  // ── 1. Database ────────────────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    logger.error('Health check — DB connectivity failed', err);
    overallStatus = 'error';
  }

  // ── 2. BullMQ Queue Depths ─────────────────────────────────────────
  let discoveryCount: Record<string, number> = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  let extractionCount: Record<string, number> = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  let validationCount: Record<string, number> = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  let dlqCount: Record<string, number> = { waiting: 0, active: 0, delayed: 0, failed: 0 };

  try {
    const [dCounts, eCounts, vCounts, dlqCounts] = await Promise.all([
      discoveryQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      extractionQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      validationQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      dlq.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    ]);
    discoveryCount = dCounts;
    extractionCount = eCounts;
    validationCount = vCounts;
    dlqCount = dlqCounts;
    redisStatus = 'connected';
  } catch (err) {
    logger.error('Health check — Redis/BullMQ connectivity failed', err);
    redisStatus = 'error';
    if (overallStatus === 'ok') overallStatus = 'degraded';
  }

  // ── 3. Serper Circuit Breaker ──────────────────────────────────────
  let serperCircuit: 'closed' | 'open' | 'unknown' = 'unknown';
  try {
    serperCircuit = (await isSerperCircuitOpen()) ? 'open' : 'closed';
    if (serperCircuit === 'open' && overallStatus === 'ok') {
      overallStatus = 'degraded';
    }
  } catch {
    serperCircuit = 'unknown';
  }

  // ── 4. LLM Provider Configuration ─────────────────────────────────
  const checkProvider = (envKeys: string[]): 'configured' | 'not_configured' => {
    return envKeys.some((key) => !!process.env[key]) ? 'configured' : 'not_configured';
  };

  const llmProviders = {
    cerebras: checkProvider(['CEREBRAS_API_KEY', 'CEREBRAS_API_KEYS']),
    groq: checkProvider(['GROQ_API_KEY', 'GROQ_API_KEYS']),
    gemini: checkProvider(['GEMINI_API_KEY', 'GEMINI_API_KEYS']),
  };

  // Groq is the primary required provider
  if (llmProviders.groq === 'not_configured' && overallStatus === 'ok') {
    overallStatus = 'degraded';
  }

  // ── 5. Browserless Configuration ───────────────────────────────────
  const browserless: 'configured' | 'not_configured' = process.env.BROWSERLESS_URL
    ? 'configured'
    : 'not_configured';

  // ── 6. Serper API Key ──────────────────────────────────────────────
  const serperConfigured: 'configured' | 'not_configured' = process.env.SERPER_API_KEY
    ? 'configured'
    : 'not_configured';

  if (serperConfigured === 'not_configured' && overallStatus === 'ok') {
    overallStatus = 'degraded';
  }

  // ── Build response ─────────────────────────────────────────────────
  const body = {
    status: overallStatus,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    db: dbStatus,
    redis: redisStatus,
    queue: {
      discovery: discoveryCount,
      extraction: extractionCount,
      validation: validationCount,
      dlq: dlqCount,
    },
    serperCircuit,
    serperApiKey: serperConfigured,
    llmProviders,
    browserless,
  };

  const httpStatus = overallStatus === 'error' ? 503 : 200;

  return NextResponse.json(body, { status: httpStatus });
}

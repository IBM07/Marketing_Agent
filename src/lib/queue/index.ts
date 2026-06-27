/**
 * src/lib/queue/index.ts
 *
 * Centralized BullMQ queue definitions and shared IORedis connection.
 * All workers and callers import from here so there is exactly one
 * IORedis connection pool per process.
 *
 * Queue topology:
 *   discoveryQueue    — receives a raw prompt → produces a list of target URLs
 *   extractionQueue   — receives a URL + jobId → produces extracted contacts
 *   validationQueue   — receives leadId + filteredText → persists / approves lead
 *   emailStatusQueue  — repeatable heartbeat: polls Resend API for email status updates
 *   dlq               — dead-letter: jobs that failed 3 times land here
 */

import { Queue, QueueEvents } from "bullmq";
import type { ConnectionOptions } from "bullmq";

// ---------------------------------------------------------------------------
// Redis connection — shared across all queues and workers in this process.
// REDIS_URL must be set in the environment (e.g. redis://localhost:6379 or
// a Upstash / Redis Cloud TLS URL).
// ---------------------------------------------------------------------------
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Typed BullMQ connection config.
 * Parsed from REDIS_URL so we never need an IORedis instance inside
 * BullMQ constructors — eliminating all @ts-expect-error suppressions.
 */
export const connectionConfig: ConnectionOptions = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || "6379"),
  password: new URL(REDIS_URL).password || undefined,
  tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
};

/**
 * Keep a raw IORedis export in case any non-BullMQ code ever needs it
 * (e.g., for Upstash REST rate-limiting helpers). Not used by workers.
 */
import IORedis from "ioredis";
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// ---------------------------------------------------------------------------
// Default job options shared by every queue
// ---------------------------------------------------------------------------
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5_000, // 5 s → 25 s → 125 s
  },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 50 },
};

// ---------------------------------------------------------------------------
// Queue instances
// ---------------------------------------------------------------------------

/** Phase 1: user prompt → list of target URLs */
export const discoveryQueue = new Queue<DiscoveryJobData>("discovery", {
  connection: connectionConfig,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/** Phase 2: single URL → extracted lead contacts */
export const extractionQueue = new Queue<ExtractionJobData>("extraction", {
  connection: connectionConfig,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/** Phase 3: single lead → validated and persisted */
export const validationQueue = new Queue<ValidationJobData>("validation", {
  connection: connectionConfig,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 1 }, // validation is best-effort
});

/** Email status poller: repeatable heartbeat that polls Resend API for open/click/bounce events */
export const emailStatusQueue = new Queue<EmailStatusPollJobData>("email-status", {
  connection: connectionConfig,
  defaultJobOptions: { removeOnComplete: { count: 50 }, removeOnFail: { count: 20 }, attempts: 1 },
});

/** Dead-letter queue: jobs that exhausted all retries */
export const dlq = new Queue<FailedJobData>("dlq", {
  connection: connectionConfig,
  defaultJobOptions: { removeOnComplete: { count: 500 }, attempts: 1 },
});

// ---------------------------------------------------------------------------
// QueueEvents — used by the status endpoint to listen for completion
// ---------------------------------------------------------------------------
export const discoveryQueueEvents = new QueueEvents("discovery", {
  connection: connectionConfig,
});

// ---------------------------------------------------------------------------
// Job data shapes
// ---------------------------------------------------------------------------

export interface DiscoveryJobData {
  jobId: string;       // PipelineJob.id
  workspaceId: string;
  prompt: string;
  userId: string;
}

export interface ExtractionJobData {
  jobId: string;       // PipelineJob.id
  workspaceId: string;
  url: string;
  targetCriteria: string;
}

export interface ValidationJobData {
  jobId: string;       // PipelineJob.id
  workspaceId: string;
  leadId: string;
  sourceUrl: string;
  filteredText: string;
  targetCriteria: string;
}

/** Email status poller carries no payload — it's a periodic heartbeat */
export interface EmailStatusPollJobData {
  triggeredAt: string; // ISO timestamp for logging/debugging
}

export interface FailedJobData {
  originalQueue: string;
  jobId: string;
  data: unknown;
  errorMessage: string;
  failedAt: string;
}

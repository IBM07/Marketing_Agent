/**
 * src/lib/queue/worker-server.ts
 *
 * Standalone worker process entry point.
 *
 * This file is intentionally separate from the Next.js app server.
 * It must be run as a long-lived Node.js process (e.g. via a separate
 * DigitalOcean App Platform worker component, or pm2/foreverjs locally).
 *
 * Start command: npx tsx src/lib/queue/worker-server.ts
 *
 * Worker concurrency:
 *   - Discovery: 2 (one per active user session — orchestration is fast)
 *   - Extraction: 5 (I/O-bound scraping — safe to parallelize)
 *   - Validation: 1 (sequential to respect AI token quotas)
 */

import "dotenv/config"; // Load .env in local dev

import { startDiscoveryWorker } from "./workers/discovery.worker";
import { startExtractionWorker } from "./workers/extraction.worker";
import { startValidationWorker } from "./workers/validation.worker";
import { logger } from "../logger";

logger.info("[WORKER_SERVER] Starting all BullMQ workers...");

const discoveryWorker = startDiscoveryWorker();
const extractionWorker = startExtractionWorker();
const validationWorker = startValidationWorker();

logger.info("[WORKER_SERVER] All workers running. Press Ctrl+C to stop.");

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`[WORKER_SERVER] Received ${signal} — shutting down gracefully`);

  await Promise.all([
    discoveryWorker.close(),
    extractionWorker.close(),
    validationWorker.close(),
  ]);

  logger.info("[WORKER_SERVER] All workers closed cleanly. Exiting.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

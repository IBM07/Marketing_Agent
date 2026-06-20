# Changelog

All notable changes to HyperDrive AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-06-14

### Added

#### Core Pipeline
- Autonomous lead generation agent with **BullMQ async job queue** (3-worker architecture: Discovery → Extraction → Validation)
- Non-blocking `POST /api/agent` — returns `{ jobId, status: "queued" }` immediately; clients poll `/api/agent/status?jobId=` for progress
- `GET /api/agent/status` polling endpoint with live `QUEUED → RUNNING → DONE → FAILED` status transitions
- Worker server (`worker-server.ts`) runs as a separate process alongside Next.js

#### AI & LLM
- 3-provider LLM fallback chain: **Cerebras** (`gpt-oss-120b`) → **Groq** (`llama-3.3-70b-versatile`) → **Gemini** (`gemini-2.5-flash-lite`)
- Per-key exponential backoff (1s → 2s → 4s) on HTTP 429 errors with automatic key rotation
- Comma-separated multi-key pools via `CEREBRAS_API_KEYS`, `GROQ_API_KEYS`, `GEMINI_API_KEYS`
- Regex-first email extraction — zero LLM tokens consumed when regex succeeds

#### Lead Validation
- 3-agent validation engine: **Criteria** (does the lead match the prompt?) → **Intent** (are they a decision-maker?) → **Quality** (is the data complete?)
- Anti-hallucination citation guard — LLM must cite actual text from the scraped page
- Permanently-failed validation jobs routed to a Dead Letter Queue (DLQ)

#### Campaign Management
- Full campaign CRUD with soft-delete (`deletedAt`) and status machine: `DRAFT → ACTIVE → COMPLETED / PAUSED / PARTIAL`
- Batch email dispatch via **Resend batch API** (100 emails/call) and **SMTP** with concurrency control (5 parallel, 500ms inter-chunk delay)
- HTML email content sanitized with `sanitize-html` before storage and dispatch (prevents XSS / CSS injection)

#### Security
- **GDPR / CAN-SPAM unsubscribe system** — opt-outs stored per workspace, filtered pre-flight on every send
- **Daily email quota enforcement** — tracked via `QUOTA_EXCEEDED` EmailLog status
- **AES-256-GCM credential encryption** for BYOK SMTP passwords and Resend API keys
- Secrets returned masked (`••••••••`) on GET; submitting the mask is a no-op
- `ENCRYPTION_KEY` required env var validated at startup via Zod

#### Infrastructure
- **BullMQ + IORedis** typed connection config — eliminates all `@ts-expect-error` suppressions
- `getOrCreateWorkspace()` shared utility — DRY refactor removing 5 copies of the same logic
- Atomic `PipelineJob` DONE transition using compound `updateMany` to eliminate race conditions
- `decrementValidationAndCheckDone()` called in the `on('failed')` handler to prevent stuck jobs
- `decrypt()` calls wrapped in try/catch — graceful error instead of 500 on key rotation / corruption
- `PipelineJobStatus` Prisma enum (`QUEUED | RUNNING | DONE | FAILED`) for compile-time safety
- `filteredText` added to `extractLeadsFromUrl()` return type — removes unsafe `as unknown` casts
- `extractWithGemini()` returns `null` on exhaustion (matches `extractWithCerebras` / `extractWithGroq` contract)
- Docker containerization with 3-stage build (`deps → builder → runner`), non-root `nextjs` user
- CI/CD via GitHub Actions — lint + type-check + build + unit tests on every PR and push to `main`
- All required env vars (`ENCRYPTION_KEY`, `CRON_SECRET`, `SERPER_API_KEY`, `REDIS_URL`) added to CI build step

#### Developer Experience
- Security comment in `api-handler.ts` — documents why `error.message` must never reach the client response
- `.env.example` updated with dedicated `REDIS_URL` entry and clear required/optional annotations
- Project structure documentation updated to include `src/lib/queue/` and `worker-server.ts`

---

## [Unreleased]

> Features planned or in progress — not yet released.

- Server Components migration for dashboard pages (currently Client Components)
- Cursor-based pagination (replaces `skip/take` at 10K+ leads)
- Structured logging via Datadog / Logtail integration
- Database connection pooling via PgBouncer / Prisma Accelerate
- Bundle size optimization (Three.js tree-shaking)
- A/B email testing for campaigns
- Visual workflow builder for automated follow-up sequences

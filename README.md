# 🚀 HyperDrive AI — Autonomous AI Lead Generation & Email Outreach Engine

> **Deploy agents that search the web, scrape publicly available contact information, and build verified lead lists.** Built on Next.js 15, Cerebras/Groq/Gemini AI, Docker, and a stunning WebGL UI.

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-15.3.6-black) ![Prisma](https://img.shields.io/badge/Prisma-7.5.0-2D3748) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6) ![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker) ![Groq](https://img.shields.io/badge/Groq-LLM-orange) ![Cerebras](https://img.shields.io/badge/Cerebras-LLM-purple)

---

## 🎯 Overview

**HyperDrive AI** is a self-hostable, open-source lead generation platform that autonomously searches the web, scrapes publicly available contact information, and builds verified lead lists — all powered by multi-LLM AI agents. It is **not** an enrichment database like Apollo or Hunter; it finds contacts by actually crawling the web in real-time. It features:

- 🔍 **Autonomous Lead Generation Agent** — Natural language prompt → Serper.dev Google Search → URL filtering → Cheerio HTML scrape → Regex extraction (LLM skipped if emails found) → Cerebras/Groq/Gemini fallback chain → PostgreSQL upsert
- 🤖 **Multi-LLM Key Rotation** — Cerebras (primary, 1M tok/day free) → Groq (secondary) → Gemini (final fallback), with per-key exponential backoff and 429 rotation
- 📧 **Campaign Management** — Full CRUD with soft-delete, pagination, `DRAFT → ACTIVE → COMPLETED / PAUSED / PARTIAL` statuses
- 📨 **Dual Email Dispatch** — BYOK (user's own Resend API key or SMTP) with platform Resend fallback; batch API for Resend (100/call), concurrency-limited SMTP (5 parallel connections with 500ms delay between chunks)
- 🔐 **AES-256-GCM Credential Encryption** — BYOK SMTP passwords and Resend keys encrypted at rest
- 👥 **Workspace Isolation** — all leads, campaigns, email logs scoped per workspace
- 🚫 **GDPR/CAN-SPAM Unsubscribe System** — opt-outs stored per workspace, filtered pre-flight on every send
- 📊 **Daily Email Quota Enforcement** — tracked via `QUOTA_EXCEEDED` EmailLog status, surfaced in Settings
- 🔔 **Webhook Integrations** — Clerk (user provisioning via Svix) + Resend (delivery tracking: sent/delivered/opened/clicked/bounced/complained)
- ⚡ **Dual Rate Limiting** — Upstash Redis sliding window (agent route) + in-memory token bucket (all other routes)
- 🩺 **Health Check** — `/api/health` with live DB ping for container orchestration
- ✨ **Stunning WebGL UI** — Three.js 4000-particle hero, Framer Motion, GSAP, Lenis smooth scroll

---

## 🕵️ How the Lead Generation Agent Works

The pipeline runs **asynchronously** via a BullMQ job queue (3 workers: Discovery → Extraction → Validation). `POST /api/agent` enqueues the job and returns immediately; clients poll `GET /api/agent/status?jobId=` for progress.

1. **Discovery Worker** — LLM translates the prompt into 10-15 targeted Google search queries via Serper.dev. URLs are filtered through 10+ block-lists (aggregators, social media, CDNs) and capped at 200 unique URLs.
2. **Extraction Worker** — Each URL is processed in its own job:
   - **Fetch:** Grabs HTML with a 5s timeout and standard browser User-Agent.
   - **Cleanse:** Cheerio strips noise (navs, footers, modals, cookie banners).
   - **Markdown:** Converts to Markdown via `node-html-markdown`.
   - **Regex-First:** Extracts emails via regex. If found, **LLM is skipped entirely** (0 tokens).
   - **LLM Fallback:** Cerebras → Groq → Gemini chain if regex finds nothing.
3. **Validation Worker** — 3-agent gate (Criteria → Intent → Quality) with anti-hallucination citation guard. Failed leads go to a Dead Letter Queue (DLQ).
4. **Persist** — Upserts leads into PostgreSQL. Atomic `PipelineJob` DONE transition prevents race conditions under concurrent completions.

---

## 🧠 Multi-LLM & Security Architecture

### KeyRotationLLMClient
HyperDrive AI maximizes uptime and throughput via a smart rotation and fallback system:
- **Primary:** Cerebras (`gpt-oss-120b`) for ultra-fast, free tier extraction (1M tokens/day).
- **Secondary:** Groq (`llama-3.3-70b-versatile`).
- **Fallback:** Gemini (`gemini-2.5-flash-lite`).
- **Resilience:** Implements per-key exponential backoff (1s, 2s, 4s) on HTTP 429 errors.
- **Scale:** Supports comma-separated multi-key pools via environment variables.

### Security Architecture
- **BYOK Encryption:** User-provided SMTP passwords and Resend API keys are encrypted at rest using AES-256-GCM.
- **Masking:** Secrets are returned masked (`••••••••`) on GET requests. Submitting the mask results in a no-op, preserving the existing key.
- **Protection:** Clerk middleware enforces authentication on all non-public routes.
- **Headers:** Strict security headers configured in `next.config.mjs` (`X-Frame-Options: DENY`, HSTS, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy).

---

## 🛠 Tech Stack

### Frontend & Framework
| Package | Version | Purpose |
|---------|---------|---------|
| [Next.js](https://nextjs.org/) | 15.3.6 | React framework — App Router, API routes, SSR |
| [React](https://react.dev/) | 19 | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com/) | 3.4.1 | Utility-first CSS framework |

### Animation & Visual Effects
| Package | Version | Purpose |
|---------|---------|---------|
| [Framer Motion](https://www.framer.com/motion/) | 12.38.0 | Declarative React animations |
| [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) | 9.x | React renderer for Three.js |
| [Three.js](https://threejs.org/) | 0.169.0 | 3D WebGL particle system |
| [drei](https://github.com/pmndrs/drei) | 10.x | React Three Fiber helpers |
| [GSAP](https://gsap.com/) | 3.14.2 | High-performance animation timeline |
| [Lenis](https://lenis.darkroom.engineering/) | 1.3.19 | Smooth scroll provider |

### Backend & Database
| Package | Version | Purpose |
|---------|---------|---------|
| [Prisma](https://www.prisma.io/) | 7.5.0 | ORM with enum statuses and DB indexes |
| [PostgreSQL] | — | Relational database (via Prisma Driver Adapters) |
| [@prisma/adapter-pg](https://www.prisma.io/) | 7.5.0 | Native PG adapter for Prisma |
| `pg` | 8.20.0 | Native PostgreSQL driver |

### Authentication & APIs
| Package | Version | Purpose |
|---------|---------|---------|
| [Clerk](https://clerk.com/) | 7.3.1 | Auth, user management, webhook provisioning |
| [Groq API](https://groq.com/) | via `fetch` | Ultra-fast LLM inference (Llama 3.3 70B) — called via raw HTTP |
| [@google/genai](https://aistudio.google.com/) | 2.4.0 | Gemini LLM fallback |
| [Resend](https://resend.com/) | 6.9.4 | Transactional email API |
| `nodemailer` | 8.0.7 | SMTP email dispatch for BYOK |
| `svix` | 1.92.2 | Clerk/Resend webhook signature verification |

### Data, Validation & Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| `cheerio` | 1.2.0 | Server-side HTML parsing for scraper |
| `node-html-markdown` | 2.0.0 | HTML → Markdown conversion |
| [Zod](https://zod.dev/) | 4.4.3 | Schema validation for all API inputs |
| `@upstash/ratelimit` | 2.0.8 | Distributed Redis rate limiter |
| `@upstash/redis` | 1.38.0 | Redis client for Upstash |
| `xlsx` | 0.18.5 | CSV/Excel parsing |
| [Lucide React](https://lucide.dev/) | 0.577.0 | Icon library |

---

## 📁 Project Structure

```text
hyperdrive-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/
│   │   │   │   └── route.ts          # Core lead-gen agent (4-phase pipeline)
│   │   │   ├── ai/
│   │   │   │   └── generate/
│   │   │   │       └── route.ts      # AI email generation (Groq, fallback, caching)
│   │   │   ├── analytics/
│   │   │   │   └── route.ts          # Email & campaign analytics API
│   │   │   ├── campaigns/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts      # Campaign retrieval (by ID)
│   │   │   │   ├── __tests__/        # Campaign API unit tests
│   │   │   │   ├── send/
│   │   │   │   │   └── route.ts      # Batch email send with retry + EmailLog persistence
│   │   │   │   └── route.ts          # Campaign CRUD (GET, POST, PATCH, DELETE)
│   │   │   ├── cron/
│   │   │   │   └── resume-campaigns/ # Cron job for resuming partial campaigns
│   │   │   ├── health/
│   │   │   │   └── route.ts          # Health check endpoint (DB connectivity)
│   │   │   ├── leads/
│   │   │   │   └── route.ts          # Leads CRUD (GET paginated+search, POST, PATCH, DELETE)
│   │   │   ├── settings/
│   │   │   │   ├── check/
│   │   │   │   │   └── route.ts      # Environment configuration check API
│   │   │   │   └── route.ts          # Settings save/load with AES-256-GCM masking
│   │   │   ├── stats/
│   │   │   │   └── route.ts          # Live statistics overview API
│   │   │   ├── unsubscribe/
│   │   │   │   └── route.ts          # GDPR opt-out handler (public)
│   │   │   ├── webhook/
│   │   │   │   └── clerk/
│   │   │   │       └── route.ts      # Clerk webhook — user & workspace provisioning
│   │   │   └── webhooks/
│   │   │       └── resend/
│   │   │           └── route.ts      # Resend webhook — email delivery tracking
│   │   ├── dashboard/
│   │   │   ├── __tests__/            # Dashboard unit tests
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx          # Analytics view
│   │   │   ├── campaigns/
│   │   │   │   ├── [id]/             # Campaign detail page (dynamic route)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx      # New campaign wizard
│   │   │   │   └── page.tsx          # Campaigns list
│   │   │   ├── settings/
│   │   │   │   └── page.tsx          # User settings
│   │   │   ├── error.tsx             # Dashboard-scoped error boundary
│   │   │   ├── layout.tsx            # Dashboard layout (sidebar, nav)
│   │   │   ├── loading.tsx           # Dashboard skeleton loader
│   │   │   └── page.tsx              # Dashboard home / overview
│   │   ├── docs/
│   │   │   └── page.tsx              # Public documentation page
│   │   ├── privacy/                  # Privacy policy page
│   │   ├── sign-in/                  # Clerk-hosted sign-in
│   │   ├── sign-up/                  # Clerk-hosted sign-up
│   │   ├── terms/                    # Terms of service page
│   │   ├── error.tsx                 # Global error boundary page
│   │   ├── globals.css               # Global styles & CSS variables
│   │   ├── layout.tsx                # Root layout (ClerkProvider, fonts)
│   │   ├── loading.tsx               # Global loading state
│   │   ├── not-found.tsx             # Custom 404 page
│   │   ├── page.tsx                  # Landing page (WebGL hero, sections)
│   │   ├── robots.ts                 # robots.txt generation
│   │   └── sitemap.ts                # sitemap.xml generation
│   ├── components/
│   │   ├── canvas/
│   │   │   └── HeroScene.tsx         # Three.js WebGL 4000-particle hero animation
│   │   ├── providers/
│   │   │   └── SmoothScroll.tsx      # Lenis smooth scroll provider
│   │   └── ErrorBoundary.tsx         # React class-based error boundary
│   ├── lib/
│   │   ├── __tests__/                # Library unit tests
│   │   ├── agent/
│   │   │   └── orchestrator.ts       # NL prompt → AgentPlan (10-15 search queries)
│   │   ├── ai/
│   │   │   └── rotation-client.ts    # KeyRotationLLMClient (Cerebras → Groq → Gemini)
│   │   ├── mail/
│   │   │   ├── dispatcher.ts         # dispatchEmail + dispatchEmailBatch (Resend + SMTP)
│   │   │   └── providerLimits.ts     # DAILY_EMAIL_LIMIT constant
│   │   ├── queue/
│   │   │   ├── workers/
│   │   │   │   ├── discovery.worker.ts   # Worker 1: prompt → target URLs
│   │   │   │   ├── extraction.worker.ts  # Worker 2: URL → extracted contacts
│   │   │   │   └── validation.worker.ts  # Worker 3: lead validation + DB persist
│   │   │   ├── index.ts              # BullMQ queue definitions + typed connectionConfig
│   │   │   ├── pipeline.ts           # Helper: enqueue a full discovery job
│   │   │   └── worker-server.ts      # Entry point for the standalone worker process
│   │   ├── scraper/
│   │   │   ├── extractor.ts          # 6-step extraction pipeline
│   │   │   ├── filter.ts             # Contact segment filter (email/phone/keyword lines)
│   │   │   ├── regex-extractor.ts    # Zero-token regex extraction (skips LLM)
│   │   │   └── search.ts             # Serper.dev search + URL filter (100 results, 10+ block lists)
│   │   ├── api-handler.ts            # Centralized async API wrapper (error mapping)
│   │   ├── env.ts                    # Environment variable validation
│   │   ├── errors.ts                 # Typed error classes (AppError hierarchy)
│   │   ├── logger.ts                 # Structured JSON logger (info/warn/error)
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── rate-limit.ts             # In-memory sliding-window & Upstash rate limiter
│   │   ├── security.ts               # AES-256-GCM encrypt/decrypt for BYOK credentials
│   │   └── workspace.ts              # getOrCreateWorkspace() shared utility
│   └── middleware.ts                 # Clerk route protection middleware
├── .github/
│   └── workflows/
│       └── ci.yml                    # Lint + build + unit test on PRs & pushes
├── prisma/
│   └── schema.prisma                 # Database schema (enums, indexes, relations)
├── e2e/
│   ├── campaign-flow.spec.ts         # Playwright E2E — full campaign creation flow
│   └── global.setup.ts               # Playwright global auth setup
├── .dockerignore                     # Docker ignore rules
├── .env.example                      # Environment variable template
├── Dockerfile                        # 3-stage build (deps → builder → runner), non-root user
├── next.config.mjs                   # Next.js configuration (Security headers)
├── package.json                      # Project dependencies & scripts
├── playwright.config.ts              # Playwright configuration
├── prisma.config.ts                  # Prisma build configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── vitest.config.ts                  # Vitest unit test configuration
└── vitest.setup.ts                   # Vitest setup environment
```

---

## 🗄️ Database Schema

Seven models with enum-based statuses and optimized indexes:

```text
User ──< Workspace ──< Campaign ──< EmailLog
                  ──< Lead ──< CampaignLead
                  ──< Unsubscribe
```

| Model | Key Fields |
|-------|-----------|
| `User` | `id`, `clerkId` (unique), `email` (unique), `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword` (AES-256), `resendApiKey` (AES-256), `senderEmail`, `senderName` |
| `Workspace` | `id`, `name`, `description`, `userId` (FK → User) |
| `Lead` | `id`, `email`, `companyName`, `prospectName`, `phone`, `role`, `scrapedFromUrl`, `isEnriched`, `workspaceId` (FK → Workspace) — unique on `(workspaceId, email)` |
| `Campaign` | `id`, `name`, `goal`, `targetAudience`, `status` (CampaignStatus), `workspaceId` (FK → Workspace), `deletedAt` (soft-delete) |
| `CampaignLead` | `id`, `campaignId` (FK → Campaign), `leadId` (FK → Lead) — unique on `(campaignId, leadId)` |
| `EmailLog` | `id`, `campaignId` (FK → Campaign), `leadId` (FK → Lead), `recipient`, `subject`, `content`, `status` (EmailStatus), `resendId` (unique), `smtpMessageId` (unique), `sentAt` |
| `Unsubscribe` | `id`, `workspaceId` (FK → Workspace), `email`, `reason` — unique on `(workspaceId, email)` |

**Enums:**
- `CampaignStatus`: `DRAFT` | `ACTIVE` | `COMPLETED` | `PAUSED` | `PARTIAL`
- `EmailStatus`: `PENDING` | `SENT` | `DELIVERED` | `OPENED` | `CLICKED` | `FAILED` | `BOUNCED` | `COMPLAINED` | `QUOTA_EXCEEDED`

**Indexes:** 
- `Campaign(workspaceId, createdAt DESC)`
- `Lead(workspaceId, createdAt DESC)`
- `EmailLog(campaignId, status)`
- `EmailLog(campaignId, createdAt DESC)`
- `EmailLog(leadId)`
- `CampaignLead(campaignId)`
- `CampaignLead(leadId)`
- `Unsubscribe(workspaceId, email)`

---

## 🔗 API Endpoints

### 🔍 Lead Generation Agent
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agent` | Trigger autonomous lead generation pipeline |

**Auth:** Clerk required | **Rate Limit:** 5 req/min (Upstash Redis sliding window)

**Request:**
```json
{
  "prompt": "Find digital marketing agencies in New York"
}
```

**Response** *(job enqueued — non-blocking):*
```json
{ "jobId": "uuid", "status": "queued" }
```

Poll for progress with `GET /api/agent/status?jobId=<jobId>`:
```json
{ "status": "RUNNING", "processedUrls": 42, "totalUrls": 120, "leadsFound": 17 }
```
Final status values: `QUEUED` → `RUNNING` → `DONE` | `FAILED`

---

### 📝 Leads Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leads` | List leads (paginated, search by email/company/name) |
| `POST` | `/api/leads` | Manually create a lead (upsert) |
| `PATCH` | `/api/leads?id=<id>` | Update lead fields |
| `DELETE` | `/api/leads?id=<id>` | Delete a lead |

---

### ⚙️ Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Load settings (secrets returned as ••••••••) |
| `POST` | `/api/settings` | Save settings (smart masking — •••••••• = no change, "" = clear) |
| `GET` | `/api/settings/check` | Verify system configuration flags (database, APIs, webhooks) |

---

### 🚫 Unsubscribe
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/unsubscribe` | Record opt-out for GDPR/CAN-SPAM compliance (public, no auth) |

---

### 🤖 AI Email Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/generate` | Generate AI cold email copy |

**Request:** `{ "prompt": "...", "goal": "Lead Gen", "productName": "...", "model": "llama-3.3-70b-versatile" }`

---

### 📢 Campaign Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/campaigns` | List campaigns (paginated) |
| `GET` | `/api/campaigns/[id]` | Fetch campaign details and email logs |
| `POST` | `/api/campaigns` | Create a new campaign |
| `PATCH` | `/api/campaigns` | Update campaign fields / status |
| `DELETE` | `/api/campaigns?id=<id>` | Soft-delete a campaign |

---

### 📨 Email Sending
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/campaigns/send` | Batch-send emails for a campaign |

**Request:**
```json
{
  "campaignId": "uuid",
  "recipients": ["alice@example.com", "bob@example.com"],
  "subject": "quick question",
  "content": "Email body text..."
}
```
- Max **500 recipients** per request.
- Unsubscribed emails are filtered out pre-flight.
- Emails sent with **exponential backoff** retry (up to 3 attempts).
- Campaign status transitions to `COMPLETED` or `PARTIAL` based on quota exhaustion.

---

### 📊 Analytics & Live Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Retrieve live campaign and email metrics overview |
| `GET` | `/api/analytics` | Retrieve aggregated email event analytics grouped by date |

---

### 🪝 Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhook/clerk` | Clerk user lifecycle events (`user.created` provisions User & Workspace) |
| `POST` | `/api/webhooks/resend` | Resend email tracking events (updates EmailLog status) |

---

### ⏱️ Cron Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cron/resume-campaigns` | Resumes campaigns in `PARTIAL` status (auth required via `CRON_SECRET`) |

---

## 🔐 Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk public key |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ | Clerk Sign-in path (e.g. `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ | Clerk Sign-up path (e.g. `/sign-up`) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | ✅ | Clerk post sign-in redirect (e.g. `/dashboard`) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | ✅ | Clerk post sign-up redirect (e.g. `/dashboard`) |
| `CLERK_WEBHOOK_SECRET` | ✅ | Svix verification for Clerk webhooks |
| `SERPER_API_KEY` | ✅ | Google Search API (serper.dev) — agent won't run without this |
| `GROQ_API_KEY` | ✅ | Primary LLM (also used for AI email generation) |
| `ENCRYPTION_KEY` | ✅ | 64-char hex — AES-256-GCM for BYOK credentials |
| `CRON_SECRET` | ✅ | Authenticates `/api/cron/*` endpoints |
| `NEXT_PUBLIC_APP_URL` | ✅ | Production URL (SEO, OG tags, sitemap) |
| `RESEND_API_KEY` | ⚠️ Optional | Platform-level fallback email sender |
| `RESEND_FROM_EMAIL` | ⚠️ Optional | Verified sender address (must be custom domain in prod) |
| `RESEND_WEBHOOK_SECRET` | ⚠️ Optional | Delivery tracking webhooks |
| `CEREBRAS_API_KEY` | ⚠️ Optional | Faster/free extraction LLM (1M tok/day) |
| `CEREBRAS_API_KEYS` | ⚠️ Optional | Comma-separated pool for key rotation |
| `GROQ_API_KEYS` | ⚠️ Optional | Comma-separated pool for key rotation |
| `GEMINI_API_KEY` | ⚠️ Optional | Final LLM fallback |
| `GEMINI_API_KEYS` | ⚠️ Optional | Comma-separated pool for key rotation |
| `UPSTASH_REDIS_REST_URL` | ⚠️ Optional | Distributed rate limiting for agent route |
| `UPSTASH_REDIS_REST_TOKEN` | ⚠️ Optional | Upstash Redis auth token |
| `REDIS_URL` | ✅ | Redis connection URL for BullMQ pipeline (e.g. `redis://localhost:6379`) |
| `E2E_CLERK_EMAIL` | 🧪 Dev only | Playwright E2E test credentials |
| `E2E_CLERK_PASSWORD` | 🧪 Dev only | Playwright E2E test credentials |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+** and **npm**
- **Docker + Docker Compose** (for the easiest setup, or for production)
- **Clerk** account ([clerk.com](https://clerk.com))
- **Serper.dev** account ([serper.dev](https://serper.dev) - free tier)
- **Groq** account ([groq.com](https://groq.com))
- **Cerebras** account (optional but recommended — [cloud.cerebras.ai](https://cloud.cerebras.ai))
- **Gemini** API key (optional — [aistudio.google.com](https://aistudio.google.com))
- **Resend** account (optional — [resend.com](https://resend.com))

### Option A: Local Development (npm)

1. **Clone the repository**
   ```bash
   git clone https://github.com/IBM07/Marketing_Agent.git
   cd Marketing_Agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Fill in all required variables
   ```

4. **Start Redis** (in a separate terminal)
   ```bash
   docker run -p 6379:6379 redis:alpine
   ```

5. **Push the database schema**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Run the BullMQ worker** (in a second separate terminal — required for lead generation)
   ```bash
   npm run worker:dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

> [!IMPORTANT]
> The worker process (`npm run worker:dev`) **must be running** alongside `npm run dev` for the lead generation pipeline to process jobs. Without it, jobs will be enqueued but never executed.

### Option B: Docker Deployment (Recommended for Production)

The entire stack — Postgres, Redis, Browserless, the web app, and the BullMQ worker — runs self-contained with a single command.

1. **Clone and configure**
   ```bash
   git clone https://github.com/IBM07/Marketing_Agent.git
   cd Marketing_Agent
   cp .env.example .env
   # Fill in your Clerk, Serper, Groq/Cerebras keys
   # DATABASE_URL, REDIS_URL, and BROWSERLESS_URL are auto-configured by Docker Compose
   ```

2. **Start the stack**
   ```bash
   docker compose up -d
   ```

3. **Verify the deployment**
   ```bash
   curl http://localhost:3000/api/health
   ```
   You should see `"status": "ok"` with `"db": "connected"` and `"redis": "connected"`.

4. **View logs**
   ```bash
   docker compose logs -f app worker
   ```

#### Production Hardening Notes

| Concern | Recommendation |
|---------|----------------|
| **Database** | Use a managed PostgreSQL instance (Neon, Supabase, AWS RDS) and override `DATABASE_URL` in your `.env` |
| **Redis persistence** | The docker-compose Redis uses AOF persistence. For production, consider a managed Redis (Upstash, Redis Cloud) |
| **Reverse proxy** | Place Nginx or Caddy in front of port 3000 with SSL termination |
| **Secrets** | Never commit `.env` to version control. Use Docker secrets or a vault in production |
| **Monitoring** | The `/api/health` endpoint is compatible with any uptime monitor or container orchestrator |

### 🌐 Deploying to a Server

#### Option C: VPS (DigitalOcean Droplet, Hetzner, AWS EC2, etc.)

The fastest path to a live public URL. Works on any Ubuntu 22.04 VPS.

1. **SSH into your server and install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER && newgrp docker
   ```

2. **Clone the repo and configure:**
   ```bash
   git clone https://github.com/IBM07/Marketing_Agent.git
   cd Marketing_Agent
   cp .env.example .env
   nano .env   # Fill in your API keys
   ```

3. **Start the full stack:**
   ```bash
   docker compose up -d
   ```

4. **Set up Caddy for automatic HTTPS** (replace `yourdomain.com` with your actual domain):
   ```bash
   sudo apt install -y caddy
   sudo nano /etc/caddy/Caddyfile
   ```
   Paste this:
   ```
   yourdomain.com {
       reverse_proxy localhost:3000
   }
   ```
   ```bash
   sudo systemctl reload caddy
   ```
   Caddy automatically provisions a free Let's Encrypt SSL certificate. Your app is now live at `https://yourdomain.com`.

5. **Update `NEXT_PUBLIC_APP_URL`** in your `.env` to `https://yourdomain.com`, then rebuild:
   ```bash
   docker compose up -d --build
   ```

> [!TIP]
> For a $6/month VPS recommendation: DigitalOcean's Basic Droplet (1 vCPU, 1GB RAM) handles up to ~10 concurrent users easily. Upgrade to 2GB RAM if you run many concurrent lead-gen jobs.

---

#### Option D: DigitalOcean App Platform (Managed — No Server to Maintain)

DigitalOcean App Platform builds and runs your Docker container automatically on every push to `main`.

1. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps) → **Create App** → **GitHub**
2. Select `IBM07/Marketing_Agent`, branch `main`, check **Autodeploy**
3. DigitalOcean auto-detects the `Dockerfile`
4. Set **HTTP Port** to `3000` and **Health Check Path** to `/api/health`
5. Add all environment variables from `.env.example` under **App-Level Env Vars**
6. Add a second **Worker** component pointing to `Dockerfile.worker` — this runs the BullMQ pipeline
7. Click **Deploy**

> [!NOTE]
> Use a **managed PostgreSQL** (DO Databases, Neon, or Supabase) and **managed Redis** (Upstash or DO Redis) for App Platform — the bundled `docker-compose.yml` services don't apply here.

---

#### Option E: Railway

Railway supports multi-service deployments via `railway.toml` or a Dockerfile.

1. Install Railway CLI: `npm i -g @railway/cli` → `railway login`
2. ```bash
   cd Marketing_Agent
   railway init
   railway up
   ```
3. Add a second service for the worker: **New Service → GitHub Repo → Custom Start Command:** `node_modules/.bin/tsx src/lib/queue/worker-server.ts`
4. Add a PostgreSQL and Redis plugin from the Railway dashboard
5. Set environment variables in Railway dashboard; Railway auto-injects `DATABASE_URL` and `REDIS_URL`

---

#### Option F: Render

1. Go to [render.com](https://render.com) → **New** → **Web Service** → connect `IBM07/Marketing_Agent`
2. **Environment:** Docker | **Dockerfile Path:** `./Dockerfile`
3. **Health Check Path:** `/api/health`
4. Add environment variables in the dashboard
5. Create a second **Background Worker** service pointing to `Dockerfile.worker` for the BullMQ workers
6. Add a PostgreSQL and Redis instance from the Render dashboard

---

### ⚙️ Webhooks & Cron Setup

#### 1. Clerk Webhooks
To provision users and workspaces automatically when they sign up:
1. Go to your Clerk Dashboard → **Webhooks** → **Add Endpoint**.
2. Endpoint URL: `https://your-domain.com/api/webhook/clerk`
3. Subscribe to the `user.created` event.
4. Copy the Signing Secret to your `.env.local` as `CLERK_WEBHOOK_SECRET`.

#### 2. Resend Webhooks
To track email delivery statuses (delivered, bounced, clicked):
1. Go to your Resend Dashboard → **Webhooks** → **Add Webhook**.
2. Endpoint URL: `https://your-domain.com/api/webhooks/resend`
3. Select events: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`.
4. Copy the Signing Secret to your `.env.local` as `RESEND_WEBHOOK_SECRET`.

#### 3. Cron Job Configuration
To automatically resume campaigns paused by daily email limits, you must schedule a request to the cron endpoint.
Configure a cron job (via GitHub Actions, cron-job.org, or your cloud provider) to make the following HTTP request once every 24 hours:
```http
GET https://your-domain.com/api/cron/resume-campaigns
Authorization: Bearer <YOUR_CRON_SECRET>
```

---

## 🛠️ Troubleshooting

### Jobs enqueue but no leads are found
**Cause:** The BullMQ worker is not running.  
**Fix:** Start the worker process in a second terminal:
```bash
npm run worker:dev   # local dev
# OR for Docker:
docker compose up worker
```

### `Error: REDIS_URL is required`
**Cause:** Redis is not running or `REDIS_URL` is missing from your `.env`.  
**Fix:**
```bash
# Quick local Redis via Docker:
docker run -d -p 6379:6379 redis:alpine
# Then set in .env:
REDIS_URL=redis://localhost:6379
```

### `PrismaClientInitializationError` on startup
**Cause:** Database is not reachable or schema hasn't been pushed.  
**Fix:**
```bash
npx prisma db push    # creates all tables from schema
npx prisma generate   # regenerates the Prisma client
```

### Clerk sign-in redirects to an error page
**Cause:** `NEXT_PUBLIC_APP_URL` doesn't match your Clerk app's **Allowed Origins**.  
**Fix:** Go to Clerk Dashboard → **Domains** → add your local URL (`http://localhost:3000`) or your production domain.

### `docker compose up` fails with "image not found"
**Cause:** The Docker image needs to be built first.  
**Fix:** Use `docker compose up --build` on first run (and after any code changes).

### Health check shows `"db": "error"` 
**Cause:** The database container isn't ready yet.  
**Fix:** Wait 30–60 seconds for PostgreSQL to fully initialize, then retry `curl http://localhost:3000/api/health`.

### `ENCRYPTION_KEY` error on startup
**Cause:** The encryption key is missing or too short (must be 64 hex characters / 32 bytes).  
**Fix:** Generate a new one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and set `ENCRYPTION_KEY=<output>` in your `.env`.

---

## 🔧 CI/CD

- **Docker:** Uses a 3-stage Dockerfile (`deps` → `builder` → `runner`) with a non-root `nextjs` user for security.
- **Healthcheck:** Container performs a live DB ping via `curl -f http://localhost:3000/api/health` every 30s.
- **CI:** `.github/workflows/ci.yml` runs linter, Prisma generation, build, and unit tests on PRs and pushes to `main`/`master`.

---

## 🧪 Testing

### Unit Tests (Vitest)
```bash
npm run test          # Run all unit tests
npm run test:watch    # Watch mode
```
Tests live in `src/lib/__tests__/`, `src/app/api/campaigns/__tests__/`, and `src/app/dashboard/__tests__/`.

### End-to-End Tests (Playwright)
```bash
npm run test:e2e
```
E2E specs live in `e2e/`. The `campaign-flow.spec.ts` test covers the full campaign creation user journey with Clerk authentication.

---

## 🗂 NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start Next.js development server |
| `build` | `prisma generate && next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint . --ext .ts,.tsx,.js,.jsx` | Run ESLint |
| `test` | `vitest run` | Run unit tests |
| `test:watch` | `vitest` | Run unit tests in watch mode |
| `test:e2e` | `playwright test` | Run E2E tests |
| `worker:dev` | `tsx watch src/lib/queue/worker-server.ts` | Start BullMQ worker (hot-reload) |
| `worker:start` | `tsx src/lib/queue/worker-server.ts` | Start BullMQ worker (production) |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

---

## 👨‍💻 Author

Built by **Ibrahim Aejaz**
- Twitter/X: [@IBMAZ_10](https://x.com/IBMAZ_10)
- LinkedIn: [mohammedibrahimaejaz](https://www.linkedin.com/in/mohammedibrahimaejaz/)

---

## 📄 License

This project is open-source and licensed under the **MIT License**. You are free to use, modify, and distribute it for both commercial and non-commercial purposes. See the [LICENSE](LICENSE) file for complete details.

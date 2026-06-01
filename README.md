# 🚀 HyperDrive AI — Autonomous AI Lead Generation & Email Outreach Engine

> **Deploy agents that search the web, scrape high-quality data, and extract verified contacts.** Built on Next.js 15, Cerebras/Groq/Gemini AI, DigitalOcean App Platform, and a stunning WebGL UI.

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-15.3.6-black) ![Prisma](https://img.shields.io/badge/Prisma-7.5.0-2D3748) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6) ![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker) ![DigitalOcean](https://img.shields.io/badge/DigitalOcean-deployed-0080FF?logo=digitalocean) ![Groq](https://img.shields.io/badge/Groq-LLM-orange) ![Cerebras](https://img.shields.io/badge/Cerebras-LLM-purple)

---

## 🎯 Overview

**HyperDrive AI** is a full-stack SaaS platform that empowers builders to create hyper-converting marketing campaigns powered by autonomous AI agents. It features:

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

The autonomous lead generation pipeline (`POST /api/agent`) operates in 4 robust phases:

1. **Orchestration** — LLM translates a natural language prompt into 10-15 highly targeted Google search queries.
2. **Search & Filter** — Serper.dev fetches up to 100 results per query. URLs are aggressively filtered through 10+ block-lists (aggregators, job boards, social media, CDNs) and capped at 200 unique URLs.
3. **Scrape & Extract** — Processed in throttled batches (10 URLs per batch, 500ms delay):
   - **Fetch:** Grabs HTML with a 5s timeout and standard browser User-Agent.
   - **Cleanse:** Cheerio strips out noise (navs, footers, modals, cookie banners).
   - **Markdown:** Converts to Markdown using `node-html-markdown`.
   - **Filter:** Retains only lines matching email/phone regex or contact context keywords.
   - **Regex-First:** Extracts emails via Regex. If found, **LLM extraction is skipped entirely** (0 tokens used).
   - **LLM Fallback:** If Regex fails but contact signals exist, it falls back to the Multi-LLM chain.
4. **Persist** — Upserts leads into the PostgreSQL database, handling duplicate race conditions gracefully (Prisma P2002).

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
| [Groq SDK](https://groq.com/) | 1.1.2 | Ultra-fast LLM inference (Llama 3.3 70B) |
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
│   │   └── security.ts               # AES-256-GCM encrypt/decrypt for BYOK credentials
│   └── middleware.ts                 # Clerk route protection middleware
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + build + unit test on PRs & pushes
│       └── deploy.yml                # Auto-deploy to DigitalOcean via doctl on main push
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
  "prompt": "Find digital marketing agencies in Karachi"
}
```

**Response:**
```json
{
  "success": true,
  "plan": { "searchQueries": ["query 1", "query 2"], "targetCriteria": "..." },
  "targetUrls": ["url1", "url2"],
  "leadsExtracted": 47,
  "leadsSkipped": 3,
  "leads": [{ "id": "...", "email": "...", "companyName": "..." }]
}
```

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
| `E2E_CLERK_EMAIL` | 🧪 Dev only | Playwright E2E test credentials |
| `E2E_CLERK_PASSWORD` | 🧪 Dev only | Playwright E2E test credentials |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+** and **npm**
- **Neon PostgreSQL** database ([neon.tech](https://neon.tech))
- **Clerk** account ([clerk.com](https://clerk.com))
- **Serper.dev** account ([serper.dev](https://serper.dev) - free tier)
- **Groq** account ([groq.com](https://groq.com))
- **Cerebras** account (optional but recommended — [cloud.cerebras.ai](https://cloud.cerebras.ai))
- **Gemini** API key (optional — [aistudio.google.com](https://aistudio.google.com))
- **Upstash Redis** (optional — [upstash.com](https://upstash.com), free tier, no credit card)
- **Resend** account (optional — [resend.com](https://resend.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd hyperdrive-ai
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

4. **Push the database schema**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

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

## 🚢 Deployment (DigitalOcean App Platform)

The application is containerized and configured for auto-deployment to DigitalOcean App Platform.

- **Docker:** Uses a 3-stage Dockerfile (`deps` → `builder` → `runner`) with a non-root `nextjs` user for security.
- **Healthcheck:** Container performs a live DB ping via `curl -f http://localhost:3000/api/health` every 30s.
- **CI/CD:** 
  - `.github/workflows/ci.yml`: Runs linter, Prisma generation, build, and unit tests on PRs and pushes to `main`/`master`.
  - `.github/workflows/deploy.yml`: Auto-deploys via `doctl apps create-deployment` on push to `main`.
- **Secrets:** Requires `DIGITALOCEAN_ACCESS_TOKEN` and `DIGITALOCEAN_APP_ID` configured in GitHub Secrets.

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
| `dev` | `next dev` | Start development server |
| `build` | `prisma generate && next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint . --ext .ts,.tsx,.js,.jsx` | Run ESLint with specific file extensions |
| `test` | `vitest run` | Run unit tests |
| `test:watch` | `vitest` | Run unit tests in watch mode |
| `test:e2e` | `playwright test` | Run E2E tests |

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

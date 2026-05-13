# 🚀 HyperDrive AI — AI-Powered Marketing Campaigns

> **Transform non-technical builders into engineering powerhouses** with AI-driven cold email generation, workspace management, and production-ready campaign automation. Built on Next.js 15, Groq AI, and a stunning WebGL UI.

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-15.3.6-black) ![Prisma](https://img.shields.io/badge/Prisma-7.5.0-2D3748) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)

---

## 🎯 Overview

**HyperDrive AI** is a full-stack SaaS platform that empowers builders to create hyper-converting marketing campaigns powered by AI. It features:

- 🤖 **AI-Powered Email Generation** — Groq-backed LLM (Llama 3.3 70B) generates psychology-driven cold emails with automatic model fallback and 5-minute response caching
- 📧 **Campaign Management** — Full CRUD for campaigns with soft-delete, pagination, and enum-based status tracking (`DRAFT → ACTIVE → COMPLETED / PAUSED`)
- 📨 **Email Sending with Retry Logic** — Batch-send emails via Resend with exponential backoff (3 retries), HTML sanitization, and per-recipient `EmailLog` persistence
- 👥 **Workspace Isolation** — Each user gets an isolated workspace; campaigns and email logs are scoped per workspace
- 🔐 **Enterprise Auth** — Clerk authentication with middleware-enforced route protection and webhook-driven user provisioning
- 📊 **Analytics Dashboard** — Campaign and email performance views within the dashboard
- ✨ **Stunning UI** — WebGL particle hero animation (Three.js / React Three Fiber), Framer Motion, GSAP, and Lenis smooth scroll
- 🩺 **Health Check** — `/api/health` endpoint for DB connectivity monitoring
- 🔍 **SEO-Ready** — `robots.ts`, `sitemap.ts`, Open Graph, and Twitter Card metadata out of the box
- 📈 **Observability** — Vercel Analytics and Speed Insights integrated in the root layout

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
| [PostgreSQL (Neon)](https://neon.tech/) | — | Serverless relational database |
| [@prisma/adapter-pg](https://www.prisma.io/) | 7.5.0 | Native PG adapter for Prisma |

### Authentication & APIs
| Package | Version | Purpose |
|---------|---------|---------|
| [Clerk](https://clerk.com/) | 7.0.5 | Auth, user management, webhook provisioning |
| [Groq SDK](https://groq.com/) | 1.1.2 | Ultra-fast LLM inference (Llama 3.3 70B) |
| [Resend](https://resend.com/) | 6.9.4 | Transactional email API |
| [Svix](https://svix.com/) | 1.92.2 | Clerk webhook signature verification |

### Data, Validation & Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| [Zod](https://zod.dev/) | 4.4.3 | Schema validation for all API inputs |
| [XLSX](https://github.com/SheetJS/sheetjs) | 0.18.5 | CSV/Excel parsing for recipient uploads |
| [Lucide React](https://lucide.dev/) | 0.577.0 | Icon library |
| [@vercel/analytics](https://vercel.com/analytics) | 2.0.1 | Page-view analytics |
| [@vercel/speed-insights](https://vercel.com/docs/speed-insights) | 2.0.0 | Core Web Vitals monitoring |

### Testing
| Package | Version | Purpose |
|---------|---------|---------|
| [Vitest](https://vitest.dev/) | 4.1.5 | Unit test runner |
| [Playwright](https://playwright.dev/) | 1.59.1 | End-to-end browser testing |
| [@clerk/testing](https://clerk.com/docs/testing) | 2.0.27 | Clerk auth helpers for E2E tests |
| [@testing-library/react](https://testing-library.com/) | 16.3.2 | React component testing utilities |

---

## 📁 Project Structure

```
hyperdrive-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   └── generate/
│   │   │   │       └── route.ts           # AI email generation (Groq, model fallback, caching)
│   │   │   ├── campaigns/
│   │   │   │   ├── route.ts               # Campaign CRUD (GET, POST, PATCH, DELETE)
│   │   │   │   └── send/
│   │   │   │       └── route.ts           # Batch email send with retry + EmailLog persistence
│   │   │   ├── health/
│   │   │   │   └── route.ts               # Health check endpoint (DB connectivity)
│   │   │   └── webhook/
│   │   │       └── clerk/
│   │   │           └── route.ts           # Clerk webhook — user & workspace provisioning
│   │   ├── dashboard/
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx               # Analytics view
│   │   │   ├── campaigns/
│   │   │   │   ├── [id]/                  # Campaign detail page (dynamic route)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx           # New campaign wizard
│   │   │   │   └── page.tsx               # Campaigns list
│   │   │   ├── settings/
│   │   │   │   └── page.tsx               # User settings
│   │   │   ├── error.tsx                  # Dashboard-scoped error boundary
│   │   │   ├── layout.tsx                 # Dashboard layout (sidebar, nav)
│   │   │   ├── loading.tsx                # Dashboard skeleton loader
│   │   │   └── page.tsx                   # Dashboard home / overview
│   │   ├── privacy/                       # Privacy policy page
│   │   ├── terms/                         # Terms of service page
│   │   ├── sign-in/                       # Clerk-hosted sign-in
│   │   ├── sign-up/                       # Clerk-hosted sign-up
│   │   ├── error.tsx                      # Global error boundary page
│   │   ├── layout.tsx                     # Root layout (ClerkProvider, Analytics, fonts)
│   │   ├── loading.tsx                    # Global loading state
│   │   ├── not-found.tsx                  # Custom 404 page
│   │   ├── robots.ts                      # robots.txt generation
│   │   ├── sitemap.ts                     # sitemap.xml generation
│   │   ├── page.tsx                       # Landing page (WebGL hero, sections)
│   │   └── globals.css                    # Global styles & CSS variables
│   ├── components/
│   │   ├── canvas/
│   │   │   └── HeroScene.tsx              # Three.js WebGL 4000-particle hero animation
│   │   ├── providers/
│   │   │   └── SmoothScroll.tsx           # Lenis smooth scroll provider
│   │   └── ErrorBoundary.tsx              # React class-based error boundary
│   ├── lib/
│   │   ├── api-handler.ts                 # Centralized async API wrapper (error mapping)
│   │   ├── env.ts                         # Environment variable validation
│   │   ├── errors.ts                      # Typed error classes (AppError hierarchy)
│   │   ├── logger.ts                      # Structured JSON logger (info/warn/error)
│   │   ├── prisma.ts                      # Prisma client singleton
│   │   └── rate-limit.ts                  # In-memory sliding-window rate limiter
│   └── middleware.ts                      # Clerk route protection middleware
├── prisma/
│   └── schema.prisma                      # Database schema (enums, indexes, relations)
├── e2e/
│   ├── campaign-flow.spec.ts              # Playwright E2E — full campaign creation flow
│   └── global.setup.ts                    # Playwright global auth setup
├── .env.example                           # Environment variable template
├── vercel.json                            # Vercel deployment config (region: iad1)
├── playwright.config.ts                   # Playwright configuration
├── vitest.config.ts                       # Vitest unit test configuration
├── next.config.mjs                        # Next.js configuration
├── tailwind.config.ts                     # Tailwind CSS configuration
└── package.json                           # Project dependencies & scripts
```

---

## 🗄️ Database Schema

Four models with enum-based statuses and optimized indexes:

```
User ──< Workspace ──< Campaign ──< EmailLog
```

| Model | Key Fields |
|-------|-----------|
| `User` | `id`, `clerkId` (unique), `email` |
| `Workspace` | `id`, `name`, `userId` (FK → User) |
| `Campaign` | `id`, `name`, `goal`, `targetAudience`, `status (CampaignStatus)`, `deletedAt` |
| `EmailLog` | `id`, `campaignId`, `recipient`, `subject`, `content`, `status (EmailStatus)`, `sentAt` |

**Enums:**
- `CampaignStatus`: `DRAFT` | `ACTIVE` | `COMPLETED` | `PAUSED`
- `EmailStatus`: `PENDING` | `SENT` | `FAILED` | `BOUNCED`

**Indexes:** `Campaign(workspaceId, createdAt DESC)`, `EmailLog(campaignId, status)`, `EmailLog(campaignId, createdAt DESC)`

---

## 🔗 API Endpoints

### AI Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/generate` | Generate AI cold email copy |

**Auth:** Clerk required | **Rate Limit:** 10 req/min per user

**Request:**
```json
{
  "prompt": "SaaS tool for engineers",
  "goal": "Lead Gen",
  "productName": "HyperDrive AI",
  "model": "llama-3.3-70b-versatile"
}
```
- `goal`: `"Lead Gen"` | `"Brand Awareness"` | `"Product Launch"`
- `model`: Optional — defaults to `llama-3.3-70b-versatile`, auto-falls back to `llama3-8b-8192`

**Response:** `{ "subject": string, "body": string }`

> Responses are cached in-memory for 5 minutes per unique `goal + productName + prompt + model` combination.

---

### Campaign Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/campaigns` | List campaigns (paginated) |
| `POST` | `/api/campaigns` | Create a new campaign |
| `PATCH` | `/api/campaigns` | Update campaign fields / status |
| `DELETE` | `/api/campaigns?id=<id>` | Soft-delete a campaign |

**Auth:** Clerk required | **Rate Limit (POST):** 20 req/min

**GET query params:** `?page=1&limit=20`

**POST payload:**
```json
{
  "name": "Q3 Outreach",
  "goal": "Generate 50 qualified leads",
  "targetAudience": "B2B SaaS founders"
}
```

---

### Email Sending
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/campaigns/send` | Batch-send emails for a campaign |

**Auth:** Clerk required | **Rate Limit:** 5 req/min

**Request:**
```json
{
  "campaignId": "uuid",
  "recipients": ["alice@example.com", "bob@example.com"],
  "subject": "quick question",
  "content": "Email body text..."
}
```
- Max **50 recipients** per request
- Emails sent with **exponential backoff** retry (up to 3 attempts)
- Campaign auto-transitions from `DRAFT → ACTIVE` on first successful send
- Every send attempt is recorded in `EmailLog`

---

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhook/clerk` | Clerk user lifecycle events |

Handles `user.created` to automatically provision a `User` + `Workspace` record in the database. Verified via Svix signature.

---

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service & DB connectivity status |

**Response:**
```json
{ "status": "ok", "version": "0.1.0", "uptime": 1234.56, "db": "connected" }
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | ✅ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key | ✅ |
| `CLERK_SECRET_KEY` | Clerk Secret Key | ✅ |
| `CLERK_WEBHOOK_SECRET` | Svix secret for Clerk webhook verification | ✅ |
| `GROQ_API_KEY` | Groq AI API key | ✅ |
| `RESEND_API_KEY` | Resend API key | ✅ |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `noreply@yourdomain.com`) | ✅ |
| `NEXT_PUBLIC_APP_URL` | Application base URL (e.g. `https://yourdomain.com`) | ✅ |

> **Note:** In production, `RESEND_FROM_EMAIL` must be a domain verified in your Resend account. The sandbox `onboarding@resend.dev` address will trigger a console warning when `NODE_ENV=production`.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and **npm**
- **Neon PostgreSQL** database ([neon.tech](https://neon.tech))
- **Clerk** account ([clerk.com](https://clerk.com))
- **Groq** account ([groq.com](https://groq.com))
- **Resend** account ([resend.com](https://resend.com))

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

---

## 🧪 Testing

### Unit Tests (Vitest)
```bash
npm run test          # Run all unit tests
npm run test:watch    # Watch mode
```
Tests live in `src/lib/__tests__/` and `src/app/dashboard/__tests__/`.

### End-to-End Tests (Playwright)
```bash
npm run test:e2e
```
E2E specs live in `e2e/`. The `campaign-flow.spec.ts` test covers the full campaign creation user journey with Clerk authentication.

---

## 🚢 Deployment (Vercel)

The app is pre-configured for Vercel via `vercel.json`:

- **Region:** `iad1` (US East)
- **Build Command:** `prisma generate && next build`
- **Framework:** Next.js

### Steps

1. Push your code to GitHub.
2. In the Vercel Dashboard, import the repository.
3. Add all **Environment Variables** from the table above.
4. Deploy — Vercel will run `prisma generate && next build` automatically.

Monitor your deployment health at `https://yourdomain.com/api/health`.

---

## 🗂 NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start development server |
| `build` | `prisma generate && next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint .` | Run ESLint |
| `test` | `vitest run` | Run unit tests |
| `test:watch` | `vitest` | Run unit tests in watch mode |
| `test:e2e` | `playwright test` | Run E2E tests |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

*Built with ⚡ by the HyperDrive AI team.*

# 🚀 HyperDrive AI — The Builder's Arsenal

> **Transform non-technical builders into engineering powerhouses** with AI-driven campaign generation, workspace management, and production-ready email automation. Built on cutting-edge tech with insane animations and a legendary UI.

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-15.3.6-black) ![Prisma](https://img.shields.io/badge/Prisma-7.5.0-2D3748)

---

## 🎯 Overview

**HyperDrive AI** is a full-stack SaaS platform that empowers builders to create hyper-converting marketing campaigns powered by AI. It features:

- 🤖 **AI-Powered Email Generation** — Uses advanced LLMs via Groq (Llama 3, Mixtral, etc.) to generate psychology-backed persuasive cold emails
- 📧 **Campaign Management** — Create, manage, and execute multi-recipient email campaigns
- 👥 **Workspace Isolation** — Multi-user support with Clerk authentication and isolated workspace management
- 📊 **Email Analytics** — Track campaign status, delivery logs, and email performance
- ✨ **Stunning UI** — WebGL hero animations powered by Three.js, Framer Motion, and custom gradients
- 🔐 **Enterprise Auth** — Clerk integration for seamless authentication and user management

---

## 🛠 Tech Stack

### Frontend & Framework
- **[Next.js 15.3.6](https://nextjs.org/)** — React framework with App Router and API routes
- **[React 19](https://react.dev/)** — UI library
- **[TypeScript 5](https://www.typescriptlang.org/)** — Type-safe JavaScript
- **[Tailwind CSS 3.4.1](https://tailwindcss.com/)** — Utility-first CSS framework

### Animation & Visual Effects
- **[Framer Motion 12.38.0](https://www.framer.com/motion/)** — Declarative React animations
- **[React Three Fiber 9.x](https://docs.pmnd.rs/react-three-fiber)** — React renderer for Three.js
- **[Three.js 0.169.0](https://threejs.org/)** — 3D graphics library
- **[drei 10.x](https://github.com/pmndrs/drei)** — Useful React Three Fiber companions
- **[GSAP 3.14.2](https://gsap.com/)** — High-performance animation library
- **[Lenis 1.3.19](https://lenis.darkroom.engineering/)** — Smooth scrolling library

### Backend & Database
- **[Prisma 7.5.0](https://www.prisma.io/)** — Modern ORM for database management
- **[PostgreSQL (Neon)](https://neon.tech/)** — Relational serverless database

### Authentication & APIs
- **[Clerk 7.0.5](https://clerk.com/)** — Enterprise-grade authentication and user management
- **[Groq AI](https://groq.com/)** — Ultra-fast LLM inference API
- **[Resend 6.9.4](https://resend.com/)** — Transactional email API

### Data & Utilities
- **[XLSX 0.18.5](https://github.com/SheetJS/sheetjs)** — Spreadsheet parsing for CSV/Excel uploads
- **[Lucide React 0.577.0](https://lucide.dev/)** — Beautiful icon library
- **[Zod](https://zod.dev/)** — TypeScript-first schema validation

---

## 📁 Project Structure

```
hyperdrive-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   └── generate/
│   │   │   │       └── route.ts           # AI email generation endpoint (Groq)
│   │   │   ├── campaigns/
│   │   │   │   ├── route.ts               # Campaign CRUD operations
│   │   │   │   └── send/
│   │   │   │       └── route.ts           # Email send logic with retry + batching
│   │   │   └── webhooks/
│   │   │       └── clerk/
│   │   │           └── route.ts           # Clerk webhook handler
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                 # Dashboard layout wrapper
│   │   │   ├── page.tsx                   # Dashboard home
│   │   │   ├── campaigns/
│   │   │   │   └── new/
│   │   │   │       └── page.tsx           # New campaign form
│   │   │   └── settings/
│   │   │       └── page.tsx               # User settings
│   │   ├── privacy/                       # Privacy policy
│   │   ├── terms/                         # Terms of service
│   │   ├── sign-in/                       # Clerk sign-in page
│   │   ├── sign-up/                       # Clerk sign-up page
│   │   ├── layout.tsx                     # Root application layout
│   │   ├── page.tsx                       # Hero landing page
│   │   └── globals.css                    # Global styles
│   ├── components/
│   │   └── canvas/
│   │       └── HeroScene.tsx              # Three.js WebGL hero component
│   └── lib/
│       ├── env.ts                         # Environment variable validation
│       ├── prisma.ts                      # Prisma client singleton
│       └── rate-limit.ts                  # In-memory rate limiting
├── prisma/
│   └── schema.prisma                      # Database schema definition
└── package.json                           # Project dependencies
```

---

## 🔗 API Endpoints

### AI Generation
- `POST /api/ai/generate` — Generate AI-powered cold email copy using Groq
  - **Auth**: Clerk (required)
  - **Rate Limit**: 5 requests/minute
  - **Payload**: `{ prompt: string, goal: string, targetAudience: string }`
  - **Response**: `{ subject: string, body: string }`

### Campaign Management
- `GET /api/campaigns` — Fetch all campaigns in workspace (supports pagination)
- `POST /api/campaigns` — Create a new campaign
- `PATCH /api/campaigns` — Update campaign status
- `DELETE /api/campaigns` — Soft delete campaign
- `POST /api/campaigns/send` — Send/Bulk send campaign emails with error handling and retry logic

---

## 🔐 Environment Variables

Create a `.env.local` file based on `.env.example`:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key | Yes |
| `CLERK_SECRET_KEY` | Clerk Secret Key | Yes |
| `GROQ_API_KEY` | Groq AI API Key for generation | Yes |
| `RESEND_API_KEY` | Resend API Key for sending emails | Yes |
| `RESEND_FROM_EMAIL` | Verified sending domain in Resend | Yes |
| `CLERK_WEBHOOK_SECRET` | Secret for verifying Clerk webhook requests | Yes |
| `NEXT_PUBLIC_APP_URL` | Application base URL | Yes |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and **npm/pnpm**
- **Neon PostgreSQL** database
- **Clerk account** for authentication
- **Groq account** for AI inference
- **Resend account** for emails

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
   # Fill in the required variables (see Environment Variables section)
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Deployment (Vercel)

The app is fully optimized for Vercel deployment:

1. Push your code to GitHub.
2. In the Vercel Dashboard, import the repository.
3. Configure the **Environment Variables** matching `.env.local`.
4. Ensure the build command is set to:
   ```bash
   prisma generate && next build
   ```
5. Deploy.

Vercel will automatically provision the serverless functions, optimize static assets, and ensure Next.js App Router performs optimally.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

**Built with ⚡ by the Legendary Senior Technical Architect**

*Transform builders. Empower creatives. Ship SaaS like never before.* 🚀

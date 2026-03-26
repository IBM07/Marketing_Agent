# 🚀 HyperDrive AI — The Builder's Arsenal

> **Transform non-technical builders into engineering powerhouses** with AI-driven campaign generation, workspace management, and production-ready email automation. Built on cutting-edge tech with insane animations and a legendary UI.

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-14.2.35-black) ![Prisma](https://img.shields.io/badge/Prisma-7.5.0-2D3748)

---

## 🎯 Overview

**HyperDrive AI** is a full-stack SaaS platform that empowers builders to create hyper-converting marketing campaigns powered by AI. It features:

- 🤖 **AI-Powered Email Generation** — Uses advanced LLMs (Ollama/Llama3) to generate psychology-backed persuasive cold emails
- 📧 **Campaign Management** — Create, manage, and execute multi-recipient email campaigns
- 👥 **Workspace Isolation** — Multi-user support with Clerk authentication and isolated workspace management
- 📊 **Email Analytics** — Track campaign status, delivery logs, and email performance
- ✨ **Stunning UI** — WebGL hero animations powered by Three.js, Framer Motion, and custom gradients
- 🔐 **Enterprise Auth** — Clerk integration for seamless authentication and user management

---

## 🛠 Tech Stack

### Frontend & Framework
- **[Next.js 14.2.35](https://nextjs.org/)** — React framework with App Router and API routes
- **[React 18](https://react.dev/)** — UI library
- **[TypeScript 5](https://www.typescriptlang.org/)** — Type-safe JavaScript
- **[Tailwind CSS 3.4.1](https://tailwindcss.com/)** — Utility-first CSS framework
- **[PostCSS](https://postcss.org/)** — CSS transformation tool

### Animation & Visual Effects
- **[Framer Motion 12.38.0](https://www.framer.com/motion/)** — Declarative React animations
- **[React Three Fiber 8.18.0](https://docs.pmnd.rs/react-three-fiber)** — React renderer for Three.js
- **[Three.js 0.169.0](https://threejs.org/)** — 3D graphics library
- **[drei 9.122.0](https://github.com/pmndrs/drei)** — Useful React Three Fiber companions
- **[GSAP 3.14.2](https://gsap.com/)** — High-performance animation library
- **[Lenis 1.3.19](https://lenis.darkroom.engineering/)** — Smooth scrolling library

### Backend & Database
- **[Prisma 7.5.0](https://www.prisma.io/)** — Modern ORM for database management
- **[PostgreSQL](https://www.postgresql.org/)** — Relational database (via `@prisma/adapter-pg`)
- **[pg 8.20.0](https://node-postgres.com/)** — PostgreSQL client for Node.js

### Authentication & API
- **[Clerk 7.0.5](https://clerk.com/)** — Enterprise-grade authentication and user management
- **[Resend 6.9.4](https://resend.com/)** — Transactional email API (future integration)

### Data & Utilities
- **[XLSX 0.18.5](https://github.com/SheetJS/sheetjs)** — Spreadsheet parsing for CSV/Excel uploads
- **[Lucide React 0.577.0](https://lucide.dev/)** — Beautiful icon library

### Development Tools
- **[ESLint](https://eslint.org/)** — Code linting
- **[Dotenv 17.3.1](https://www.dotenv.org/)** — Environment variable management

---

## 📁 Project Structure

```
hyperdrive-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   └── generate/
│   │   │   │       └── route.ts           # AI email generation endpoint
│   │   │   ├── campaigns/
│   │   │   │   ├── route.ts               # Campaign CRUD operations
│   │   │   │   ├── bulk-send/             # Bulk email sending
│   │   │   │   └── send/
│   │   │   │       └── route.ts           # Individual email send
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                 # Dashboard layout wrapper
│   │   │   ├── page.tsx                   # Dashboard home
│   │   │   ├── campaigns/
│   │   │   │   └── new/
│   │   │   │       └── page.tsx           # New campaign form
│   │   │   └── settings/
│   │   │       └── page.tsx               # User settings
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx               # Clerk sign-in page
│   │   ├── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx               # Clerk sign-up page
│   │   ├── fonts/                         # Custom font files
│   │   ├── layout.tsx                     # Root application layout
│   │   ├── page.tsx                       # Hero landing page
│   │   └── globals.css                    # Global styles
│   ├── components/
│   │   ├── canvas/
│   │   │   └── HeroScene.tsx              # Three.js WebGL hero component
│   │   └── providers/
│   │       └── SmoothScroll.tsx           # Lenis smooth scroll provider
│   ├── lib/
│   │   └── prisma.ts                      # Prisma client singleton
│   └── middleware.ts                      # Clerk authentication middleware
├── prisma/
│   ├── schema.prisma                      # Database schema definition
│   └── migrations/                        # Version-controlled migrations
├── Next configuration files
├── tailwind.config.ts                     # Tailwind CSS customization
├── tsconfig.json                          # TypeScript configuration
├── postcss.config.mjs                     # PostCSS configuration
├── next.config.mjs                        # Next.js configuration
└── package.json                           # Project dependencies & scripts
```

---

## 🔗 API Endpoints

### AI Generation
- `POST /api/ai/generate` — Generate AI-powered cold email copy
  - **Auth**: Clerk (required)
  - **Payload**: `{ prompt: string, model?: string }`
  - **Response**: `{ subject: string, body: string }`

### Campaign Management
- `GET /api/campaigns` — Fetch all campaigns in workspace
- `POST /api/campaigns` — Create a new campaign
- `POST /api/campaigns/send/:campaignId` — Send campaign to single recipient
- `POST /api/campaigns/bulk-send/:campaignId` — Bulk send campaign to recipients

---

## 💾 Database Schema

The project uses **Prisma ORM with PostgreSQL**. Key models:

### User
```prisma
model User {
  id        String
  clerkId   String (unique)
  email     String (unique)
  workspaces Workspace[]
  createdAt DateTime
  updatedAt DateTime
}
```

### Workspace
```prisma
model Workspace {
  id          String
  name        String
  description String?
  userId      String (FK → User)
  campaigns   Campaign[]
  createdAt   DateTime
  updatedAt   DateTime
}
```

### Campaign
```prisma
model Campaign {
  id             String
  name           String
  goal           String?
  targetAudience String?
  status         String (DRAFT | ACTIVE | COMPLETED)
  workspaceId    String (FK → Workspace)
  emailLogs      EmailLog[]
  createdAt      DateTime
  updatedAt      DateTime
}
```

### EmailLog
```prisma
model EmailLog {
  id         String
  campaignId String (FK → Campaign)
  recipient  String
  subject    String
  content    String
  status     String (PENDING | SENT | FAILED)
  sentAt     DateTime?
  createdAt  DateTime
}
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and **pnpm** (or npm/yarn)
- **PostgreSQL 12+** database
- **Docker** (optional, for running local Ollama)
- **Clerk account** for authentication
- **Ollama** (local LLM instance) for AI generation

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd hyperdrive-ai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or: npm install / yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure in `.env.local`:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/hyperdrive_ai

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
   CLERK_SECRET_KEY=<your-clerk-secret-key>

   # Email Service (Resend)
   RESEND_API_KEY=<your-resend-api-key>

   # AI Model (Local Ollama Instance)
   OLLAMA_BASE_URL=http://localhost:11434
   ```

4. **Set up the database**
   ```bash
   pnpm prisma generate
   pnpm prisma migrate dev --name init
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser. The page will auto-refresh as you edit files.

---

## 📦 Key Scripts

```bash
# Development
pnpm dev              # Start Next.js dev server with hot reload

# Production
pnpm build            # Build production-optimized bundle
pnpm start            # Start production server

# Database
pnpm prisma migrate dev          # Create and run migrations
pnpm prisma studio              # Open Prisma Studio (visual DB client)
pnpm prisma generate            # Generate Prisma client

# Code Quality
pnpm lint             # Run ESLint
```

---

## 🔐 Authentication Flow

HyperDrive AI uses **Clerk** for robust authentication:

1. **Sign-up/Sign-in** → User authenticates via Clerk (`/sign-in`, `/sign-up`)
2. **Middleware Protection** → `src/middleware.ts` protects dashboard routes
3. **User Auto-Creation** → On first login, user is automatically added to the database
4. **Workspace Init** → Default workspace created for each user
5. **API Security** → All API routes validate Clerk `userId` before processing

---

## 🤖 AI Email Generation

The platform leverages **Ollama** (local Llama3) to generate persuasive cold emails:

### System Prompt Highlights
- Pattern-interrupting subject lines (lowercase, 2-4 words)
- Psychology-backed body copy with value asymmetry
- Anti-sales CTAs with low friction
- **Max 50-word body** for maximum impact
- Automatic product link injection

### Example Output
```json
{
  "subject": "skip the eng team",
  "body": "Building without code isn't a toy anymore. The Builder's Arsenal gives you production-ready frameworks, AI agent planning, and deep Cursor mastery to ship real SaaS on Day 1. Leave the backend complexity behind. https://the-builders-arsenal.vercel.app/ Worth a 2-min peek?"
}
```

---

## 🎨 Design System & Animations

### Visual Highlights
- **Hero Scene** — Three.js WebGL rendering with dynamic particle effects
- **Smooth Scrolling** — Lenis integration for buttery scroll experience
- **Framer Motion** — Choreographed component animations
- **Gradient Overlays** — Custom radial gradients with backdrop blur
- **Icon Library** — Lucide React for consistent iconography

### Tailwind CSS
The project uses Tailwind's utility-first approach with custom color schemes, animations, and responsive design patterns.

---

## 📊 Campaign Workflow

1. **Create Campaign** — Set goal, target audience, campaign name
2. **Generate Content** — Use AI to auto-generate subject + body
3. **Add Recipients** — Upload CSV with email list (via XLSX parser)
4. **Preview** — Review email before sending
5. **Send** — Trigger bulk send or individual send via API
6. **Track** — Monitor status (PENDING → SENT → FAILED) in dashboard

---

## 🐳 Docker & Ollama Setup (Optional)

To run a local Ollama instance for LLM inference:

```bash
# Pull Ollama with Llama3
docker run -it --gpus=all -p 11434:11434 ollama/ollama

# In the container:
ollama pull llama3
```

Then set `OLLAMA_BASE_URL=http://localhost:11434` in `.env.local`.

---

## 📝 Customization & Extension

### Adding New API Routes
1. Create a new file in `src/app/api/[feature]/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` functions
3. Use `auth()` from Clerk for authentication
4. Query database via Prisma client

### Adding New Pages
1. Create a new directory in `src/app/dashboard/[page]/`
2. Add `page.tsx` with React components
3. Use `useUser()` hook from Clerk for user context

### Styling & Animations
- Update `globals.css` for global styles
- Modify `tailwind.config.ts` for custom theme colors/spacing
- Use Framer Motion for component animations

---

## 🚢 Deployment

### Vercel (Recommended)
```bash
# Connect your Git repo to Vercel
# Push to main branch → auto-deploy
```

1. Set environment variables in Vercel dashboard
2. Link to PostgreSQL database (Railway, PlanetScale, or managed service)
3. Deploy!

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## 🐛 Troubleshooting

### Port 3000 already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Database connection issues
```bash
# Test your DATABASE_URL
pnpm prisma db push --skip-generate
```

### Clerk authentication not working
- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set correctly
- Check Clerk dashboard for allowed redirect URIs
- Ensure middleware is configured in `src/middleware.ts`

### Ollama not found
- Ensure Ollama is running (`docker ps` or `ollama serve`)
- Verify `OLLAMA_BASE_URL` matches your setup
- Test locally: `curl http://localhost:11434/api/generate`

---

## 📚 Resources & Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Clerk Authentication](https://clerk.com/docs)
- [Three.js Guide](https://threejs.org/docs/)
- [Framer Motion](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please follow the guidelines in [agent_rules.md](agent_rules.md) for coding standards and best practices.

---

**Built with ⚡ by the Legendary Senior Technical Architect**

*Transform builders. Empower creatives. Ship SaaS like never before.* 🚀

# HyperDrive AI — Architecture

> **Pipeline**: User Prompt → Discovery Worker → Extraction Worker → Validation Worker → PostgreSQL

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Full Pipeline Flowchart](#full-pipeline-flowchart)
3. [BullMQ Queue Topology](#bullmq-queue-topology)
4. [Worker Responsibilities](#worker-responsibilities)
5. [AI Cascade: Cerebras → Groq → Gemini](#ai-cascade)
6. [Data Quality Layer](#data-quality-layer)
7. [Infrastructure Resilience](#infrastructure-resilience)

---

## System Overview

HyperDrive AI is a **multi-stage async pipeline** that converts a natural language lead-generation prompt into a verified list of B2B contacts stored in a PostgreSQL database. The pipeline is fully decoupled via BullMQ queues backed by Redis, meaning each stage scales independently and failures in one stage don't block the others.

```
User Browser
    │  POST /api/pipeline/start  { prompt }
    ▼
Next.js App Server
    │  Creates PipelineJob (status=PENDING) in PostgreSQL
    │  Enqueues DiscoveryJob in BullMQ
    ▼
Redis (BullMQ)  ◄──────────────────────────────────────────────────────┐
    │                                                                   │
    ▼                                                               DLQ (Dead Letter Queue)
BullMQ Workers (separate Docker container)                             │
    │                                                                   │
    ├─ Discovery Worker  ─► Extraction Worker  ─► Validation Worker ──►┘
    │
    ▼
PostgreSQL  (PipelineJob + Lead records)
```

---

## Full Pipeline Flowchart

```mermaid
flowchart TD
    A([User submits prompt]) --> B[POST /api/pipeline/start]
    B --> C{Create PipelineJob\nstatus = PENDING}
    C --> D[Enqueue DiscoveryJob\ninto BullMQ]

    D --> E[Discovery Worker]
    E --> F{Pre-flight\nSanity Gate\nLLM check}
    F -- Invalid prompt --> G([Mark job FAILED\nreturn reason])
    F -- Valid --> H[createAgentPlan\nOrchestrator → 5-7 queries]
    H --> I[searchWeb\nSerper.dev → raw URLs]
    I --> J{Circuit Breaker\nopen?}
    J -- Open --> K([Throw SerperCircuitOpenError])
    J -- Closed --> L[Domain Deduplication\nbest URL per root domain]
    L --> M[Update PipelineJob.totalUrls]
    M --> N[Fan-out: one ExtractionJob\nper URL → BullMQ]

    N --> O[Extraction Worker]
    O --> P[fetchPage\nHTTP or Browserless]
    P --> Q[decodeCfEmails\nCloudflare bypass]
    Q --> R[regexExtractContacts\nzero-token fast path]
    R --> S{Emails found?}
    S -- Yes → skip LLM --> T
    S -- No --> U[LLM extraction\nCerebras / Groq / Gemini]
    U --> T[filterContacts\nremove generic/no-reply]
    T --> V[isDuplicateCompany\nJaro-Winkler fuzzy check]
    V --> W[Enqueue ValidationJob\ninto BullMQ]

    W --> X[Validation Worker]
    X --> Y[validateEmail\nDisposable filter + DNS MX]
    Y --> Z{Confidence ≥ 0.60?}
    Z -- No --> AA([Delete lead — keep DB clean])
    Z -- Yes --> AB[3-Agent Validation\nLLM confirms accuracy]
    AB --> AC[prisma.lead.upsert\nisEnriched = true]
    AC --> AD[Increment PipelineJob.processedUrls]
    AD --> AE{All URLs done?}
    AE -- Yes --> AF([Mark PipelineJob DONE])
    AE -- No --> AE2([Wait for more workers])

    style G fill:#ff6b6b,color:#fff
    style K fill:#ff6b6b,color:#fff
    style AA fill:#ff6b6b,color:#fff
    style AF fill:#51cf66,color:#fff
    style AF fill:#51cf66,color:#fff
```

---

## BullMQ Queue Topology

```mermaid
flowchart LR
    subgraph Redis["Redis (BullMQ broker)"]
        DQ[(discovery\nqueue)]
        EQ[(extraction\nqueue)]
        VQ[(validation\nqueue)]
        DLQ[(dead-letter\nqueue)]
    end

    App[Next.js App] -- addJob --> DQ
    DQ -- Worker processes --> DW[Discovery Worker\nconcurrency: 2]
    DW -- addBulk N jobs --> EQ
    EQ -- Worker processes --> EW[Extraction Worker\nconcurrency: 5]
    EW -- addJob --> VQ
    VQ -- Worker processes --> VW[Validation Worker\nconcurrency: 3]

    DW -- failed after 3 retries --> DLQ
    EW -- failed after 3 retries --> DLQ
    VW -- failed after 3 retries --> DLQ

    DLQ -- manual review / replay --> DQ

    style DLQ fill:#ff8787,color:#fff
    style Redis fill:#1a1a2e,color:#fff
```

### Queue Configuration

| Queue | Concurrency | Retries | Backoff |
|---|---|---|---|
| `discovery` | 2 | 3 | 5s exponential |
| `extraction` | 5 | 3 | 5s exponential |
| `validation` | 3 | 3 | 5s exponential |
| `dlq` | — | 0 (terminal) | — |

---

## Worker Responsibilities

### 1. Discovery Worker (`discovery.worker.ts`)

**Input:** `{ jobId, workspaceId, prompt, userId }`

**Responsibilities:**
1. **Pre-flight sanity gate** — lightweight LLM call classifies the prompt as real/valid or fictional/gibberish. Blocks nonsensical prompts before any paid API is called.
2. **Orchestration** — calls `createAgentPlan()` to translate the prompt into 5–7 diverse Google-style search queries.
3. **Web search** — calls `searchWeb()` (Serper.dev) for each query to collect target URLs.
4. **Domain deduplication** — keeps only the best URL per root domain (priority: `/contact` > `/about` > `/team` > homepage). Reduces token usage ~40%.
5. **Fan-out** — enqueues one `ExtractionJob` per URL into the BullMQ extraction queue.

**Output:** N extraction jobs in `extractionQueue`.

---

### 2. Extraction Worker (`extraction.worker.ts`)

**Input:** `{ jobId, workspaceId, url, targetCriteria }`

**Responsibilities:**
1. **Page fetch** — HTTP fetch with a real browser UA. Falls back to Browserless (headless Chrome) for JS-rendered sites.
2. **Cloudflare bypass** — calls `decodeCfEmails()` to decode `data-cfemail` obfuscated emails before regex runs.
3. **Regex extraction** — `regexExtractContacts()` zero-latency fast path. If emails found, LLM step is skipped.
4. **LLM extraction** — if regex finds nothing, sends the page text to the AI cascade for structured extraction.
5. **Contact filtering** — `filterContacts()` removes generic/no-reply addresses and duplicate emails.
6. **Company deduplication** — `isDuplicateCompany()` uses Jaro-Winkler fuzzy matching to prevent same-company duplicates across a workspace.
7. **Enqueue validation** — one `ValidationJob` per extracted contact.

**Output:** N validation jobs in `validationQueue`.

---

### 3. Validation Worker (`validation.worker.ts`)

**Input:** `{ jobId, workspaceId, email, companyName, ... }`

**Responsibilities:**
1. **Email MX validation** — `validateEmail()` checks disposable domain blocklist + DNS MX record lookup. Drops leads with confidence < 0.60.
2. **3-Agent validation** — three independent LLM calls each score the lead's accuracy. Only leads with consensus pass.
3. **Database persistence** — `prisma.lead.upsert()` with `isEnriched: true`.
4. **Job completion tracking** — atomically increments `processedUrls`. When `processedUrls === totalUrls`, marks `PipelineJob` as `DONE`.

**Output:** Verified `Lead` record in PostgreSQL.

---

## AI Cascade

The AI cascade provides automatic failover across three LLM providers. Each provider is tried in order; on failure or quota exhaustion, the next is attempted.

```mermaid
flowchart LR
    A[LLM Request] --> B{Cerebras\nllama-3.3-70b\nfree 1M tokens/day}
    B -- success --> Z([Return result])
    B -- fail/quota --> C{Groq\nmeta-llama-3\nfree tier}
    C -- success --> Z
    C -- fail/quota --> D{Gemini Flash\nGoogle\nfree tier}
    D -- success --> Z
    D -- quota exhausted --> E([Throw — all providers exhausted])

    style Z fill:#51cf66,color:#fff
    style E fill:#ff6b6b,color:#fff
```

### Provider Details

| Provider | Model | Free Tier | Primary Use |
|---|---|---|---|
| Cerebras | `llama-3.3-70b` | 1M tokens/day | Orchestration, extraction |
| Groq | `meta-llama/llama-4-scout-17b-16e-instruct` | ~14k req/day | Fallback extraction, sanity gate |
| Gemini | `gemini-2.0-flash` | 15 req/min | Final fallback |

Configured in `src/lib/ai/rotation-client.ts`. Multi-key rotation (comma-separated `GROQ_API_KEYS`) is supported for higher throughput.

---

## Data Quality Layer

Three independent mechanisms ensure only high-quality leads reach the database:

```mermaid
flowchart TD
    RAW[Raw scraped data] --> CF[decodeCfEmails\nCloudflare bypass]
    CF --> RX[regexExtractContacts\nFast path + false-positive filter]
    RX --> FLT[filterContacts\nRemove no-reply / generic]
    FLT --> DEDUP[isDuplicateCompany\nJaro-Winkler similarity > 0.90]
    DEDUP --> MX[validateEmail\nDisposable blocklist + DNS MX]
    MX --> CONF{Confidence ≥ 0.60?}
    CONF -- No --> DROP([Drop — not persisted])
    CONF -- Yes --> AGT[3-Agent Validation\nLLM consensus check]
    AGT --> DB[(PostgreSQL\nLead record)]

    style DROP fill:#ff6b6b,color:#fff
    style DB fill:#51cf66,color:#fff
```

| Layer | Mechanism | Where |
|---|---|---|
| Cloudflare decode | XOR decode of `data-cfemail` | `regex-extractor.ts` |
| False-positive filter | Image ext / hex hash / generic domain blocklist | `regex-extractor.ts` |
| No-reply filter | Pattern blocklist (`noreply`, `support`, `info`) | `filter.ts` |
| Company deduplication | Jaro-Winkler fuzzy match (threshold 0.90) | `deduplicator.ts` |
| Email MX validation | DNS MX lookup + disposable domain blocklist | `email-validator.ts` |
| 3-Agent validation | 3 independent LLM accuracy scores | `validation.worker.ts` |

---

## Infrastructure Resilience

### Serper.dev Circuit Breaker

Tracks consecutive Serper failures in Redis. After 3 consecutive failures, opens the circuit for 5 minutes, preventing quota drain on a degraded API.

```
Redis keys:
  serper:circuit:failures  — incremented on each failure, reset on success
  serper:circuit:open      — set to "1" with 5-minute TTL when circuit opens
```

### Dead Letter Queue (DLQ)

Jobs that fail all 3 retry attempts are moved to the `dlq` BullMQ queue with full error context. DLQ entries can be manually inspected and replayed via the BullMQ dashboard or a custom admin script.

### `/api/health` Endpoint

Full system status endpoint for local debugging. Returns DB, Redis, queue depths, Serper circuit state, LLM provider configuration, and Browserless status in a single JSON response.

```bash
curl http://localhost:3000/api/health | jq
```

---

*For setup instructions, see [README.md](../README.md). For contribution guidelines, see [CONTRIBUTING.md](../CONTRIBUTING.md).*

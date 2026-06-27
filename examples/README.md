# HyperDrive AI — Example Prompts

Copy-paste any of the prompts below directly into the HyperDrive dashboard to run a live pipeline. Each example is tuned to produce 10–30 high-quality B2B leads.

---

## Quick Start

1. Start the app: `docker compose up --build -d`
2. Open `http://localhost:3000`
3. Sign in and create a workspace
4. Paste any prompt below into the **"New Discovery Job"** input
5. Hit **Run** — the pipeline starts within seconds

---

## Example Prompts

### 1. Digital Marketing Agencies — New York

```
Find emails of digital marketing agencies in New York
```

**What happens:**
- Orchestrator generates queries like: `"digital marketing agency New York"`, `"social media marketing firm NYC"`, `"SEO agency Manhattan"`, `"online marketing company New York"`
- Serper.dev returns ~40–80 URLs from agency websites, directories, and portfolio pages
- Domain deduplication collapses duplicates → ~20–35 unique domains
- Regex extractor finds emails on contact/about pages
- MX validation + 3-agent LLM confirms each lead

**Expected output:** 15–30 verified agency contacts with email, company name, and role

**Edge cases handled:**
- Cloudflare-protected agency sites → `decodeCfEmails()` bypass
- Duplicate agencies with slightly different names → Jaro-Winkler fuzzy dedup
- Generic `info@` addresses → filtered by `filterContacts()`

---

### 2. SaaS Founders — London Seed Round 2024

```
SaaS founders in London who raised seed funding in 2024
```

**What happens:**
- Orchestrator generates funding-focused queries targeting Crunchbase profiles, press releases, and founder personal sites
- ~25–50 URLs collected from founder blogs, LinkedIn alternatives, and news articles
- LLM extraction used for structured data (name, company, funding stage)
- Validation confirms email deliverability via MX lookup

**Expected output:** 10–20 founder contacts with company name, funding context, and verified email

**Edge cases handled:**
- News article pages with multiple mentions → filter for primary founder contact
- Founders with personal domains vs. company domains → both captured

---

### 3. Healthcare Software Companies — Texas

```
Healthcare software companies in Texas
```

**What happens:**
- Orchestrator generates queries targeting health-tech companies, EHR providers, and clinical software vendors in TX
- ~30–60 URLs from company websites, HIMSS directories, and press coverage
- Regex fast-path catches `@` addresses on contact pages
- Validation enforces MX check (critical for regulated industries — no bounces allowed)

**Expected output:** 10–25 healthcare software companies with decision-maker emails

**Edge cases handled:**
- Companies with `info@` + a real contact email → only non-generic email kept
- Healthcare `.org` domains with no MX → silently dropped

---

### 4. EdTech Startups — Southeast Asia

```
EdTech startups in Southeast Asia
```

**What happens:**
- Orchestrator generates region-diverse queries: Singapore, Indonesia, Philippines, Vietnam, Malaysia, Thailand
- ~40–80 URLs from startup directories, AngelList-equivalent sites, and company landing pages
- Multi-language pages handled via Cheerio HTML extraction (language-agnostic)
- Company deduplication prevents same startup appearing twice across different regional sources

**Expected output:** 10–20 EdTech startup contacts across APAC markets

**Edge cases handled:**
- `.sg`, `.ph`, `.vn`, `.my` TLD domains — all valid, MX verified
- Regional accelerator directories → scrapes individual company profile pages

---

### 5. FinTech Companies Actively Hiring Engineers

```
FinTech companies actively hiring engineers
```

**What happens:**
- Orchestrator generates hiring-intent queries: job boards, company careers pages, LinkedIn job descriptions
- URLs include `careers.fintech-company.com`, `jobs.stripe.com`-style pages
- Extraction worker scrapes careers pages for HR/recruiting contact emails
- 3-agent validation confirms emails are decision-maker quality (recruiting manager, CTO, HR Director)

**Expected output:** 10–20 FinTech companies with engineering hiring contacts

**Edge cases handled:**
- ATS (Applicant Tracking System) job pages → extracts company contact, not ATS email
- Large companies with hundreds of openings → deduplication keeps only 1 contact per domain

---

## Prompt Writing Tips

| ✅ Good Prompt Pattern | ❌ Avoid |
|---|---|
| `[Type of business] in [Location]` | Vague industry terms (`"companies"` with no niche) |
| `[Role] in [City] who [specific activity]` | Fictional or impossible subjects |
| `[Industry] companies in [Region]` | Overly broad geography (`"worldwide"`) |
| `[Niche] startups in [Country]` | Duplicate location + industry combos |

### What makes a great prompt

- **Specific niche**: `"digital marketing agency"` > `"marketing company"`
- **Specific location**: `"New York"` > `"USA"` > `"worldwide"`
- **Action context** (optional): `"actively hiring"`, `"raised seed funding in 2024"`, `"with 10-50 employees"`

### Prompts that will fail the sanity gate

The pipeline includes a pre-flight LLM classifier that rejects nonsensical prompts before any API quota is spent:

```
❌ "Unicorns on Mars doing blockchain"
❌ "asdf jkl qwer"
❌ "Tell me a joke"
❌ "Time-traveling accountants in 1850"
```

All real business prompts pass through automatically.

---

## Running the Full Benchmark

To test pipeline accuracy against a curated gold-standard dataset:

```bash
# Coming in Phase D
npx tsx scripts/benchmark.ts
```

Results are written to `docs/ACCURACY_REPORT.md`.

---

*For architecture details, see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).*
*For setup, see [README.md](../README.md).*

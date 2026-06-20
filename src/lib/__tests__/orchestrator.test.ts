/**
 * src/lib/__tests__/orchestrator.test.ts
 *
 * Tests for the agent orchestrator (createAgentPlan).
 *
 * The orchestrator calls real LLM providers (Cerebras → Groq → Gemini).
 * All three are mocked here — we test the orchestrator's logic:
 *   1. Correct cascade ordering (Cerebras first, then Groq, then Gemini)
 *   2. Handling nonsensical prompts (returns empty searchQueries)
 *   3. Returning a valid AgentPlan for real prompts
 *   4. Fallback behaviour when a provider fails
 *   5. Throwing when ALL providers fail
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the LLM client before importing the orchestrator ────────────────────
// The orchestrator creates `const llmClient = new KeyRotationLLMClient()` once
// at module load. We capture that instance in a closure variable so it survives
// vi.clearAllMocks() (which wipes mock.instances[] but not the instance itself).
//
// IMPORTANT: must be `var` not `let`/`const` — vi.mock() is hoisted above all
// declarations, so `let` would be in the Temporal Dead Zone when the factory runs.
// eslint-disable-next-line no-var
var capturedMockClient: {
  extractWithCerebras: ReturnType<typeof vi.fn>;
  extractWithGroq: ReturnType<typeof vi.fn>;
  extractWithGemini: ReturnType<typeof vi.fn>;
};

vi.mock("../ai/rotation-client", () => {
  const MockKeyRotationLLMClient = vi.fn().mockImplementation(function (this: typeof capturedMockClient) {
    this.extractWithCerebras = vi.fn();
    this.extractWithGroq = vi.fn();
    this.extractWithGemini = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    capturedMockClient = this;
  });
  return { KeyRotationLLMClient: MockKeyRotationLLMClient };
});

import { createAgentPlan } from "../agent/orchestrator";

// Returns the single llmClient instance created inside orchestrator.ts at import time.
function getMockClient() {
  return capturedMockClient;
}

const VALID_PLAN = {
  searchQueries: [
    "digital marketing agency New York",
    "social media marketing firm NYC",
    "SEO agency Manhattan",
    "online marketing company New York",
    "content marketing agency New York City",
  ],
  targetCriteria:
    "Extract email addresses, phone numbers, company name, and founder/owner/manager name.",
};

const REFUSED_PLAN = {
  searchQueries: [],
  targetCriteria: "",
};

describe("createAgentPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path — Cerebras succeeds ────────────────────────────────────────

  it("returns a valid plan when Cerebras succeeds", async () => {
    const client = getMockClient();
    client.extractWithCerebras.mockResolvedValue(VALID_PLAN);

    const plan = await createAgentPlan(
      "Find emails of digital marketing agencies in New York"
    );

    expect(plan.searchQueries).toHaveLength(5);
    expect(plan.searchQueries[0]).toBe("digital marketing agency New York");
    expect(plan.targetCriteria).toContain("email");
    // Cerebras was called — Groq and Gemini were NOT needed
    expect(client.extractWithCerebras).toHaveBeenCalledTimes(1);
    expect(client.extractWithGroq).not.toHaveBeenCalled();
    expect(client.extractWithGemini).not.toHaveBeenCalled();
  });

  // ── Cascade — Cerebras fails, Groq succeeds ────────────────────────────────

  it("falls back to Groq when Cerebras returns null", async () => {
    const client = getMockClient();
    client.extractWithCerebras.mockResolvedValue(null);
    client.extractWithGroq.mockResolvedValue(VALID_PLAN);

    const plan = await createAgentPlan("SaaS founders in London");

    expect(plan.searchQueries.length).toBeGreaterThanOrEqual(1);
    expect(client.extractWithCerebras).toHaveBeenCalledTimes(1);
    expect(client.extractWithGroq).toHaveBeenCalledTimes(1);
    expect(client.extractWithGemini).not.toHaveBeenCalled();
  });

  // ── Cascade — Cerebras + Groq fail, Gemini succeeds ──────────────────────

  it("falls back to Gemini when Cerebras and Groq both fail", async () => {
    const client = getMockClient();
    client.extractWithCerebras.mockResolvedValue(null);
    client.extractWithGroq.mockResolvedValue(null);
    client.extractWithGemini.mockResolvedValue(VALID_PLAN);

    const plan = await createAgentPlan("Healthcare software companies in Texas");

    expect(plan.searchQueries.length).toBeGreaterThanOrEqual(1);
    expect(client.extractWithCerebras).toHaveBeenCalledTimes(1);
    expect(client.extractWithGroq).toHaveBeenCalledTimes(1);
    expect(client.extractWithGemini).toHaveBeenCalledTimes(1);
  });

  // ── All providers exhausted ────────────────────────────────────────────────

  it("throws when all three providers fail", async () => {
    const client = getMockClient();
    client.extractWithCerebras.mockResolvedValue(null);
    client.extractWithGroq.mockResolvedValue(null);
    client.extractWithGemini.mockResolvedValue(null);

    await expect(
      createAgentPlan("FinTech companies hiring engineers")
    ).rejects.toThrow("Failed to orchestrate agent plan");
  });

  // ── REFUSE RULE — nonsensical prompt ──────────────────────────────────────

  it("returns empty searchQueries for a nonsensical prompt (REFUSE RULE)", async () => {
    const client = getMockClient();
    // The LLM obeys the REFUSE RULE and returns the sentinel value
    client.extractWithCerebras.mockResolvedValue(REFUSED_PLAN);

    const plan = await createAgentPlan("Unicorns on Mars doing blockchain");

    expect(plan.searchQueries).toHaveLength(0);
    expect(plan.targetCriteria).toBe("");
  });

  it("returns empty searchQueries for gibberish input", async () => {
    const client = getMockClient();
    client.extractWithCerebras.mockResolvedValue(REFUSED_PLAN);

    const plan = await createAgentPlan("sdkjfhsdkjfhsdf asdf qwerty");

    expect(plan.searchQueries).toHaveLength(0);
  });

  // ── Real prompts — valid plan shape ───────────────────────────────────────

  it("returns searchQueries array for a real business prompt", async () => {
    const client = getMockClient();
    client.extractWithCerebras.mockResolvedValue(VALID_PLAN);

    const plan = await createAgentPlan("EdTech startups in Southeast Asia");

    expect(Array.isArray(plan.searchQueries)).toBe(true);
    expect(plan.searchQueries.length).toBeGreaterThan(0);
    expect(typeof plan.targetCriteria).toBe("string");
    expect(plan.targetCriteria.length).toBeGreaterThan(0);
  });

  // ── Error propagation ──────────────────────────────────────────────────────

  it("throws a descriptive error when Cerebras throws an exception", async () => {
    const client = getMockClient();
    client.extractWithCerebras.mockRejectedValue(new Error("Network timeout"));
    client.extractWithGroq.mockResolvedValue(VALID_PLAN);

    // The orchestrator uses a single outer try/catch. When a provider throws
    // (not just returns null), the exception propagates to the outer catch,
    // which wraps it as "Failed to orchestrate agent plan." — Groq is never tried.
    // Only null/undefined returns trigger the cascade to the next provider.
    await expect(
      createAgentPlan("Real estate agents in Dubai")
    ).rejects.toThrow("Failed to orchestrate agent plan.");
  });
});

/**
 * src/lib/__tests__/deduplicator.test.ts
 *
 * Tests for company name normalization and fuzzy duplicate detection.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeCompanyName,
  jaroWinklerSimilarity,
  isDuplicateCompany,
  DEDUP_THRESHOLD,
} from "../scraper/deduplicator";

describe("normalizeCompanyName", () => {
  it("strips Inc suffix", () => {
    expect(normalizeCompanyName("Acme Inc")).toBe("acme");
  });

  it("strips Inc. with period", () => {
    expect(normalizeCompanyName("Acme Inc.")).toBe("acme");
  });

  it("strips Corp suffix", () => {
    expect(normalizeCompanyName("Acme Corp")).toBe("acme");
  });

  it("strips LLC suffix", () => {
    expect(normalizeCompanyName("Acme Solutions LLC")).toBe("acme");
  });

  it("strips Ltd suffix", () => {
    expect(normalizeCompanyName("Acme Ltd.")).toBe("acme");
  });

  it("strips Pvt suffix", () => {
    expect(normalizeCompanyName("Acme Pvt")).toBe("acme");
  });

  it("strips Incorporated", () => {
    expect(normalizeCompanyName("ACME Incorporated")).toBe("acme");
  });

  it("strips multiple suffixes", () => {
    expect(normalizeCompanyName("Acme Technologies Inc.")).toBe("acme");
  });

  it("removes leading The", () => {
    expect(normalizeCompanyName("The Acme Company")).toBe("acme");
  });

  it("collapses whitespace", () => {
    expect(normalizeCompanyName("  Acme   Solutions   Inc  ")).toBe("acme");
  });

  it("removes punctuation", () => {
    expect(normalizeCompanyName("Acme, Inc.")).toBe("acme");
  });

  it("lowercases everything", () => {
    expect(normalizeCompanyName("ACME")).toBe("acme");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeCompanyName("")).toBe("");
  });

  it("handles suffix-only input", () => {
    const result = normalizeCompanyName("LLC");
    expect(result).toBe("");
  });
});

describe("jaroWinklerSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(jaroWinklerSimilarity("acme", "acme")).toBe(1.0);
  });

  it("returns 0.0 for empty vs non-empty", () => {
    expect(jaroWinklerSimilarity("", "acme")).toBe(0.0);
  });

  it("returns high similarity for near-matches", () => {
    const sim = jaroWinklerSimilarity("acme solutions", "acme solution");
    expect(sim).toBeGreaterThan(0.95);
  });

  it("returns low similarity for different strings", () => {
    const sim = jaroWinklerSimilarity("acme", "zebra");
    expect(sim).toBeLessThan(0.6);
  });

  it("Acme vs Acme Technologies gives high similarity", () => {
    const sim = jaroWinklerSimilarity("acme", "acme tech");
    expect(sim).toBeGreaterThan(0.7);
  });
});

describe("isDuplicateCompany", () => {
  it("detects exact duplicates", () => {
    const existing = new Set(["acme"]);
    expect(isDuplicateCompany("Acme Inc", existing)).toBe(true);
  });

  it("detects fuzzy duplicates (Acme Inc vs Acme Incorporated)", () => {
    const existing = new Set(["acme"]);
    expect(isDuplicateCompany("Acme Incorporated", existing)).toBe(true);
  });

  it("does not flag different companies as duplicates", () => {
    const existing = new Set(["acme"]);
    expect(isDuplicateCompany("Zebra Solutions LLC", existing)).toBe(false);
  });

  it("skips Unknown company names", () => {
    const existing = new Set(["acme"]);
    expect(isDuplicateCompany("Unknown", existing)).toBe(false);
  });

  it("does not flag with empty existing set", () => {
    const existing = new Set<string>();
    expect(isDuplicateCompany("Acme Inc", existing)).toBe(false);
  });

  it("DEDUP_THRESHOLD is 0.90", () => {
    expect(DEDUP_THRESHOLD).toBe(0.90);
  });
});

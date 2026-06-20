/**
 * src/lib/__tests__/email-validator.test.ts
 *
 * Tests for the email MX validation and disposable domain filter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dns/promises before importing the module under test
vi.mock("dns/promises", () => ({
  default: {
    resolveMx: vi.fn(),
  },
}));

// Must import AFTER vi.mock
import dns from "dns/promises";
import { validateEmail, MIN_EMAIL_CONFIDENCE } from "../scraper/email-validator";

const mockResolveMx = dns.resolveMx as ReturnType<typeof vi.fn>;

describe("validateEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects emails with no domain (invalid format)", async () => {
    const result = await validateEmail("nodomain");
    expect(result.isValid).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.reason).toBe("Invalid format");
  });

  it("rejects known disposable domains", async () => {
    const result = await validateEmail("test@mailinator.com");
    expect(result.isValid).toBe(false);
    expect(result.confidence).toBe(0.1);
    expect(result.reason).toBe("Disposable domain");
  });

  it("rejects another disposable domain (yopmail.com)", async () => {
    const result = await validateEmail("user@yopmail.com");
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("Disposable domain");
  });

  it("validates email with valid MX records", async () => {
    mockResolveMx.mockResolvedValue([
      { exchange: "mx1.google.com", priority: 10 },
    ]);

    const result = await validateEmail("founder@realcompany.com");
    expect(result.isValid).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toBe("MX verified");
  });

  it("rejects email with no MX records", async () => {
    mockResolveMx.mockResolvedValue([]);

    const result = await validateEmail("user@nomx-domain.com");
    expect(result.isValid).toBe(false);
    expect(result.confidence).toBe(0.4);
    expect(result.reason).toBe("No MX records");
  });

  it("rejects email when DNS lookup fails", async () => {
    mockResolveMx.mockRejectedValue(new Error("ENOTFOUND"));

    const result = await validateEmail("user@nonexistent-domain-xyz.com");
    expect(result.isValid).toBe(false);
    expect(result.confidence).toBe(0.3);
    expect(result.reason).toBe("DNS lookup failed");
  });

  it("uses cached MX result on second call for same domain", async () => {
    mockResolveMx.mockResolvedValue([
      { exchange: "mx1.cachedomain.com", priority: 10 },
    ]);

    // First call — hits DNS
    const result1 = await validateEmail("a@cachedomain.com");
    expect(result1.isValid).toBe(true);
    expect(mockResolveMx).toHaveBeenCalledTimes(1);

    // Second call — should use cache
    const result2 = await validateEmail("b@cachedomain.com");
    expect(result2.isValid).toBe(true);
    expect(result2.reason).toBe("MX verified (cached)");
    expect(mockResolveMx).toHaveBeenCalledTimes(1); // no additional DNS call
  });

  it("has MIN_EMAIL_CONFIDENCE set to 0.60", () => {
    expect(MIN_EMAIL_CONFIDENCE).toBe(0.60);
  });

  it("disposable domain confidence is below MIN_EMAIL_CONFIDENCE", async () => {
    const result = await validateEmail("throw@guerrillamail.com");
    expect(result.confidence).toBeLessThan(MIN_EMAIL_CONFIDENCE);
  });
});

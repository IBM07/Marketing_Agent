/**
 * src/lib/__tests__/regex-extractor.test.ts
 *
 * Tests for the regex contact extractor including Cloudflare email decode.
 */

import { describe, it, expect } from "vitest";
import {
  regexExtractContacts,
  decodeCfEmails,
} from "../scraper/regex-extractor";

describe("regexExtractContacts", () => {
  it("extracts a standard email address", () => {
    const result = regexExtractContacts("Contact us at info@acme.com for more info");
    expect(result.emails).toContain("info@acme.com");
    expect(result.foundContacts).toBe(true);
  });

  it("extracts multiple emails", () => {
    const result = regexExtractContacts(
      "CEO: john@acme.io, CTO: jane@startup.io"
    );
    expect(result.emails).toHaveLength(2);
    expect(result.foundContacts).toBe(true);
  });

  it("filters out image file extensions", () => {
    const result = regexExtractContacts("hero@2x.png is not an email");
    expect(result.emails).toHaveLength(0);
  });

  it("filters out generic domains (example.com)", () => {
    const result = regexExtractContacts("test@example.com is a placeholder");
    expect(result.emails).toHaveLength(0);
  });

  it("filters out schema.org", () => {
    const result = regexExtractContacts("data@schema.org");
    expect(result.emails).toHaveLength(0);
  });

  it("filters out webpack hex hashes", () => {
    const result = regexExtractContacts("a1b2c3d4e5f6@domain.com");
    // This is a pure hex local part — should be filtered
    expect(result.emails).toHaveLength(0);
  });

  it("extracts phone numbers with 7+ digits", () => {
    const result = regexExtractContacts("Call us at +1 (800) 555-1234");
    expect(result.phones.length).toBeGreaterThan(0);
  });

  it("returns empty for empty string", () => {
    const result = regexExtractContacts("");
    expect(result.emails).toHaveLength(0);
    expect(result.phones).toHaveLength(0);
    expect(result.foundContacts).toBe(false);
  });

  it("deduplicates emails (case-insensitive)", () => {
    const result = regexExtractContacts(
      "John@Acme.com and also john@acme.com appear twice"
    );
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0]).toBe("john@acme.com");
  });
});

describe("decodeCfEmails", () => {
  it("decodes a valid Cloudflare-encoded email", () => {
    // Encoding for "test@example.com" with key 0x12:
    // t=0x74, e=0x65, s=0x73, t=0x74, @=0x40, e=0x65, ...
    // XORed: 0x74^0x12=0x66, 0x65^0x12=0x77, etc.
    // Key byte (first 2 hex chars) = "12"
    // Let's use a known encoding: key=0x2a, "a@b.c"
    // a=0x61 → 0x61^0x2a=0x4b, @=0x40 → 0x40^0x2a=0x6a
    // b=0x62 → 0x62^0x2a=0x48, .=0x2e → 0x2e^0x2a=0x04, c=0x63 → 0x63^0x2a=0x49
    // Encoded: "2a4b6a480449"
    const html = '<a data-cfemail="2a4b6a480449">email</a>';
    const result = decodeCfEmails(html);
    // Should contain the decoded email (not the data-cfemail attribute)
    expect(result).toContain("a@b");
  });

  it("leaves non-email decodes unchanged", () => {
    // Encoding that doesn't decode to an email (no @ or .)
    const html = '<a data-cfemail="0000">email</a>';
    const result = decodeCfEmails(html);
    // Should keep the original attribute since decoded chars won't have @ and .
    expect(result).toContain("data-cfemail");
  });

  it("handles HTML with no data-cfemail attributes", () => {
    const html = "<div>Hello world</div>";
    const result = decodeCfEmails(html);
    expect(result).toBe(html);
  });

  it("handles multiple encoded emails in the same HTML", () => {
    const html =
      '<a data-cfemail="2a4b6a480449">e1</a> <a data-cfemail="2a4b6a480449">e2</a>';
    const result = decodeCfEmails(html);
    // Both should be decoded
    expect(result).not.toContain("data-cfemail");
  });
});

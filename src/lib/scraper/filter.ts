/**
 * Processes raw markdown content retrieved from the local scraper (Cheerio + node-html-markdown).
 * Discards structural layouts, legal disclaimers, cookie warnings, and large text blocks.
 * Retains contact footprints and high-value team context signals.
 *
 * KEY RULE: Lines containing email addresses ALWAYS survive — they are never
 * discarded by noise filters, because an email is the highest-value signal.
 */
export function extractContactSegments(markdown: string): string {
  if (!markdown) return "";

  const lines = markdown.split(/\r?\n/);
  
  // High-fidelity email search engines
  const standardEmailRegex = /[\w._%+:-]+@[\w.-]+\.[a-zA-Z]{2,}/i;
  const obfuscatedEmailRegex = /[\w._%+:-]+\s*[\(\[\~]?\s*at\s*[\)\]\~]?\s*[\w.-]+\s*[\(\[\~]?\s*dot\s*[\)\]\~]?\s*[a-zA-Z]{2,}/i;
  
  // Phone number pattern (international and local formats)
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/;

  // Core contact keywords (expanded for better coverage)
  const contextKeywords = /\b(contact|founder|ceo|owner|email|phone|hiring|team|about|leadership|executive|head|director|co-founder|partners|connect|managing|manager|chief|principal|address|website|reach\s+us|get\s+in\s+touch|enquiry|inquiry)\b/i;
  
  // Negative structural selectors (removes standard cookie and navigation footprints)
  const noisePatterns = /(cookie|privacy policy|terms of service|copyright|all rights reserved|subscribe|unsubscribed|browser|stylesheet|nav-)/i;

  const refinedLines = lines
    .map(line => line.trim())
    .filter(trimmed => {
      // 1. Instantly drop empty entries and massive structural layers
      if (trimmed.length === 0 || trimmed.length > 600) return false;

      // 2. Email lines ALWAYS survive — never apply noise filter to them
      const hasEmail = standardEmailRegex.test(trimmed);
      const hasObfuscated = obfuscatedEmailRegex.test(trimmed);
      if (hasEmail || hasObfuscated) return true;

      // 3. Discard explicit legal noise (only for non-email lines)
      if (noisePatterns.test(trimmed)) return false;

      // 4. Keep target rows matching contact footprints, phone numbers, or context keywords
      const hasPhone = phoneRegex.test(trimmed);
      const hasContext = contextKeywords.test(trimmed);

      return hasContext || hasPhone;
    });

  return refinedLines.join("\n");
}

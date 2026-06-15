import nodemailer from "nodemailer";
import { Resend } from "resend";
import { decrypt } from "../security";
import { logger } from "../logger";

// ── Internal helpers ──────────────────────────────────────────────────────────
function buildSender(config: UserMailConfig): string {
  return config.senderName
    ? `"${config.senderName}" <${config.senderEmail}>`
    : config.senderEmail || "noreply@yourplatform.com";
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Batch types ───────────────────────────────────────────────────────────────
export interface BatchMailItem {
  recipient: string;
  subject: string;
  htmlContent: string;
}

export interface BatchDispatchResult {
  recipient: string;
  success: boolean;
  messageId?: string;
  error?: string;
  isQuotaError?: boolean;
}

export interface MailOptions {
  recipient: string;
  subject: string;
  htmlContent: string;
}

export interface UserMailConfig {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  senderEmail?: string | null;
  senderName?: string | null;
  resendApiKey?: string | null;
}

export async function dispatchEmail(
  config: UserMailConfig,
  options: MailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const sender = buildSender(config);

    // Prefer Resend API Key if provided
    if (config.resendApiKey) {
      // Task 1.3: Guard against malformed/corrupt encrypted values.
      let decryptedResendKey: string;
      try {
        decryptedResendKey = decrypt(config.resendApiKey);
      } catch (err) {
        logger.error("[MAIL_DISPATCH] Failed to decrypt Resend API key", err);
        return { success: false, error: "Failed to decrypt email credentials. Please re-save your API key in Settings." };
      }
      const resend = new Resend(decryptedResendKey);
      
      const { data, error } = await resend.emails.send({
        from: sender,
        to: [options.recipient],
        subject: options.subject,
        html: options.htmlContent,
      });

      if (error) {
        logger.error("[RESEND_DISPATCH_ERROR]", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    }

    // Fallback to SMTP if configured
    if (config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPassword) {
      // Task 1.3: Guard against malformed/corrupt encrypted values.
      let decryptedPassword: string;
      try {
        decryptedPassword = decrypt(config.smtpPassword);
      } catch (err) {
        logger.error("[MAIL_DISPATCH] Failed to decrypt SMTP password", err);
        return { success: false, error: "Failed to decrypt email credentials. Please re-save your SMTP password in Settings." };
      }

      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465, // true for 465, false for 587
        auth: {
          user: config.smtpUser,
          pass: decryptedPassword,
        },
        pool: false, // Ensures we don't hold connection open
        connectionTimeout: 8000,
        greetingTimeout: 5000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const info = await transporter.sendMail({
        from: sender,
        to: options.recipient,
        subject: options.subject,
        html: options.htmlContent,
      });

      return { success: true, messageId: info.messageId };
    }

    return { success: false, error: "No valid mail configuration found for user." };
  } catch (error) {
    logger.error("[MAIL_DISPATCH_CRITICAL_ERROR]", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to dispatch email." };
  }
}

// ── Bulk dispatcher ───────────────────────────────────────────────────────────
// Resend: uses batch API (max 100/call) — single HTTP round-trip per chunk.
// SMTP:   max 5 parallel connections per chunk + 200 ms delay between chunks
//         to avoid triggering rate-limits or account bans.
const SMTP_CONCURRENCY = 5;
const SMTP_DELAY_MS    = 500;
const RESEND_BATCH_MAX = 100;

// Detects if an error is a quota/rate-limit signal (no point retrying immediately)
function isQuotaLikeError(err: unknown): boolean {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return m.includes('429') || m.includes('rate limit') || m.includes('quota');
  }
  return false;
}

// Tries fn(), if it throws due to a temporary issue waits delayMs then tries once more.
// If it throws due to quota/rate-limit, re-throws immediately (no retry benefit).
async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
  try { return await fn(); }
  catch (err) {
    if (retries <= 0 || isQuotaLikeError(err)) throw err;
    await sleep(delayMs);
    return withRetry(fn, retries - 1, delayMs);
  }
}

export async function dispatchEmailBatch(
  config: UserMailConfig,
  items: BatchMailItem[]
): Promise<BatchDispatchResult[]> {
  if (items.length === 0) return [];
  const sender = buildSender(config);

  // ── Resend batch path ─────────────────────────────────────────────────────
  if (config.resendApiKey) {
    // Task 1.3: Guard against malformed/corrupt encrypted values in batch path.
    let resendKey: string;
    try {
      resendKey = decrypt(config.resendApiKey);
    } catch (err) {
      logger.error("[MAIL_DISPATCH_BATCH] Failed to decrypt Resend API key", err);
      return items.map((item) => ({
        recipient: item.recipient,
        success: false,
        error: "Failed to decrypt email credentials. Please re-save your API key in Settings.",
      }));
    }
    const resend = new Resend(resendKey);
    const results: BatchDispatchResult[] = [];

    for (const chunk of chunkArray(items, RESEND_BATCH_MAX)) {
      try {
        const { data, error } = await resend.batch.send(
          chunk.map((item) => ({
            from: sender,
            to: [item.recipient],
            subject: item.subject,
            html: item.htmlContent,
          }))
        );
        if (error) {
          logger.error("[RESEND_BATCH_ERROR]", error);
          chunk.forEach((item) =>
            results.push({ recipient: item.recipient, success: false, error: error.message })
          );
        } else {
          const batchData = data?.data;
          chunk.forEach((item, i) =>
            results.push({ recipient: item.recipient, success: true, messageId: batchData?.[i]?.id })
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Batch send failed.";
        logger.error("[RESEND_BATCH_CRITICAL]", err);
        chunk.forEach((item) =>
          results.push({ recipient: item.recipient, success: false, error: msg })
        );
      }
    }
    return results;
  }

  // ── SMTP batch path ───────────────────────────────────────────────────────
  if (config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPassword) {
    const results: BatchDispatchResult[] = [];
    const chunks = chunkArray(items, SMTP_CONCURRENCY);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const settled = await Promise.allSettled(
        chunk.map((item) =>
          withRetry(() => dispatchEmail(config, {
            recipient: item.recipient,
            subject: item.subject,
            htmlContent: item.htmlContent,
          }))
        )
      );
      settled.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          results.push({ recipient: chunk[idx].recipient, ...r.value });
        } else {
          results.push({
            recipient: chunk[idx].recipient,
            success: false,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      });
      // Pause between chunks to avoid overwhelming the SMTP server
      if (i < chunks.length - 1) await sleep(SMTP_DELAY_MS);
    }
    return results;
  }

  // ── No config ─────────────────────────────────────────────────────────────
  return items.map((item) => ({
    recipient: item.recipient,
    success: false,
    error: "No valid mail configuration found for user.",
  }));
}

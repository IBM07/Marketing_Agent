import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM optimal IV length


/**
 * Encrypts a plain text string using the global ENCRYPTION_KEY environment variable.
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) {
    throw new Error("ENCRYPTION_KEY is not defined in the environment variables.");
  }
  
  // Ensure the encryption key is exactly 32-bytes
  const key = crypto.createHash("sha256").update(String(secretKey)).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  // Return IV, auth tag, and ciphertext separated by colons
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) {
    throw new Error("ENCRYPTION_KEY is not defined in the environment variables.");
  }
  
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format.");
  }
  
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  
  const key = crypto.createHash("sha256").update(String(secretKey)).digest();
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * SOURCE OF TRUTH KEYWORDS: encryptSecret, decryptSecret, maskSecret, APP_ENCRYPTION_KEY, AES-GCM, secrets at rest
 * WHAT:  AES-256-GCM encryption for third-party credentials stored in app_settings.
 * WHY:   Batman stored OAuth/Resend/Polar/storage secrets in plain text. A database leak must
 *        not leak live credentials. Ciphertext format: "v1:<iv>:<tag>:<data>" (base64url).
 * WHERE: settings.ts (read/write of encrypted columns). Never call from client code.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "v1";

function deriveKey(secret: string): Buffer {
  // Accept any high-entropy string; hash to exactly 32 bytes.
  if (secret.length < 32) throw new Error("APP_ENCRYPTION_KEY must be at least 32 characters");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(value: string, secret: string): string {
  const [prefix, iv, tag, data] = value.split(":");
  if (prefix !== PREFIX || !iv || !tag || !data) throw new Error("Value is not an encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

/** Display form for the admin UI: never send a full secret to the browser. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  return value.length <= 8 ? "••••••••" : `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

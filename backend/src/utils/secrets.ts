import crypto, { timingSafeEqual } from "node:crypto";
import { getConfig } from "../config/env";

const ALGORITHM = "aes-256-gcm";

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(getConfig().secretEncryptionKey).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(ciphertext: string): string {
  const [version, ivValue, tagValue, encryptedValue] = ciphertext.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported encrypted secret format");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function safeSecretEquals(expected: string, received: string | null | undefined): boolean {
  if (!received) {
    return false;
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

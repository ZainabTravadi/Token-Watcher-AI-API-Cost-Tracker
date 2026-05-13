import crypto from "node:crypto";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash a password using scrypt
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against its hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  try {
    const computedHash = scryptSync(password, salt, 32).toString("hex");
    return timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

/**
 * Generate a secure random ID (8 characters)
 */
export function generateId(prefix: string): string {
  const random = randomBytes(6).toString("hex").slice(0, 8);
  return `${prefix}_${random}`;
}

/**
 * Generate an API key with a specific format: tw_live_xxxxx
 */
export function generateApiKey(): string {
  const random = randomBytes(24).toString("hex");
  return `tw_live_${random}`;
}

/**
 * Hash an API key for storage (so we never store plain keys)
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Create a JWT token
 */
export function createJwt(userId: string, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ userId, iat: Math.floor(Date.now() / 1000) })).toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export function verifyJwt(token: string, secret: string): { userId: string; iat: number } | null {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (!timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    return payload as { userId: string; iat: number };
  } catch {
    return null;
  }
}

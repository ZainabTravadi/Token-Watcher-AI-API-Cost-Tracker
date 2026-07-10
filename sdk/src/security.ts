import type { TokenWatchSignedHeaders, TokenWatchStateSnapshot } from "./types.js";

function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  throw new Error("TokenWatch SDK requires Web Crypto for request signing");
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  getCrypto().getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  return toHex(await getCrypto().subtle.digest("SHA-256", encoded));
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const crypto = getCrypto();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(signature);
}

export async function createSignedHeaders(
  state: TokenWatchStateSnapshot,
  method: string,
  path: string,
  body: string
): Promise<TokenWatchSignedHeaders> {
  const timestamp = String(Date.now());
  const nonce = randomNonce();
  const bodyHash = await sha256Hex(body);
  const canonical = [
    method.toUpperCase(),
    path,
    timestamp,
    nonce,
    state.workspaceId,
    bodyHash
  ].join("\n");
  const signature = await hmacSha256Hex(state.apiKey, canonical);

  return {
    "X-TokenWatch-Workspace": state.workspaceId,
    "X-TokenWatch-Timestamp": timestamp,
    "X-TokenWatch-Nonce": nonce,
    "X-TokenWatch-Signature": signature
  };
}

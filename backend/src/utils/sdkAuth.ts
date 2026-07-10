import crypto from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";

interface VerifyOptions {
  required: boolean;
  toleranceMs: number;
}

interface VerifyResult {
  ok: boolean;
  error?: string;
}

const replayWindow = new Map<string, number>();
let lastReplayCleanupAt = 0;

export function verifySignedSdkRequest(
  request: AuthenticatedRequest,
  apiKey: string,
  workspaceId: string,
  options: VerifyOptions
): VerifyResult {
  const signature = readHeader(request.headers["x-tokenwatch-signature"]);
  const timestamp = readHeader(request.headers["x-tokenwatch-timestamp"]);
  const nonce = readHeader(request.headers["x-tokenwatch-nonce"]);
  const declaredWorkspaceId = readHeader(request.headers["x-tokenwatch-workspace"]);
  const hasAnySigningHeaders = Boolean(signature || timestamp || nonce || declaredWorkspaceId);

  if (!hasAnySigningHeaders && !options.required) {
    return { ok: true };
  }

  if (!signature || !timestamp || !nonce || !declaredWorkspaceId) {
    return { ok: false, error: "Signed SDK headers are required" };
  }

  if (declaredWorkspaceId !== workspaceId) {
    return { ok: false, error: "Workspace verification failed" };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, error: "Invalid request timestamp" };
  }

  const now = Date.now();
  if (Math.abs(now - timestampMs) > options.toleranceMs) {
    return { ok: false, error: "Request timestamp outside allowed window" };
  }

  cleanupReplayWindow(now);
  const replayKey = `${workspaceId}:${nonce}`;
  if (replayWindow.has(replayKey)) {
    return { ok: false, error: "Replay detected" };
  }

  const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
  const expectedSignature = signSdkRequest({
    method: request.method,
    path: request.originalUrl ?? request.path,
    timestamp,
    nonce,
    workspaceId,
    body: rawBody,
    apiKey
  });

  if (!safeEqual(signature, expectedSignature)) {
    return { ok: false, error: "Invalid request signature" };
  }

  replayWindow.set(replayKey, now + options.toleranceMs);
  return { ok: true };
}

interface SignInput {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  workspaceId: string;
  body: string;
  apiKey: string;
}

function signSdkRequest(input: SignInput): string {
  const bodyHash = crypto.createHash("sha256").update(input.body).digest("hex");
  const canonical = [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    input.workspaceId,
    bodyHash
  ].join("\n");

  return crypto.createHmac("sha256", input.apiKey).update(canonical).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanupReplayWindow(now: number): void {
  if (now - lastReplayCleanupAt < 60000) {
    return;
  }

  lastReplayCleanupAt = now;
  for (const [key, expiresAt] of replayWindow) {
    if (expiresAt <= now) {
      replayWindow.delete(key);
    }
  }
}

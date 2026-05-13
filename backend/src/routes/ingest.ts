import { Router } from "express";
import { ingestTelemetry, validateTelemetryPayload } from "../services/ingestService";
import { authenticateSDK, type AuthenticatedRequest } from "../middleware/auth";

const ingestWindowMs = 10_000;
const ingestBurstLimit = 120;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function createIngestRouter(): Router {
  const router = Router();

  router.post("/ingest", authenticateSDK, handleIngest);

  return router;
}

function handleIngest(request: AuthenticatedRequest, response: any): void {
  const ip = String(request.ip ?? request.headers["x-forwarded-for"] ?? "local");
  const rateState = checkRateLimit(ip);

  if (!rateState.allowed) {
    response.status(429).json({ error: "Rate limit exceeded", retryAfterMs: rateState.retryAfterMs });
    return;
  }

  try {
    const payload = validateTelemetryPayload(request.body);
    const result = ingestTelemetry(request.workspaceId!, payload);

    console.info(`[ingest] ip=${ip} workspace=${request.workspaceId} count=${result.inserted} path=${request.originalUrl ?? request.path}`);

    response.status(201).json({ ok: true, inserted: result.inserted, rows: result.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to ingest telemetry";
    console.warn(`[ingest:error] ip=${ip} path=${request.originalUrl ?? request.path} reason=${message}`);
    response.status(400).json({ error: message });
  }
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const current = requestCounts.get(ip);

  if (!current || now >= current.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + ingestWindowMs });
    return { allowed: true };
  }

  if (current.count >= ingestBurstLimit) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  return { allowed: true };
}
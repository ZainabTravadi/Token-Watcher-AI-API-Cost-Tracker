import { telemetryBus } from "./telemetryBus";
import { insertTelemetry, insertTelemetryBatch } from "./telemetryRepository";
import { invalidateAnalyticsCache } from "./analyticsCache";
import type { TelemetryRecord } from "../types/telemetry";
import type { IngestTelemetryInput } from "../types/ingest";

export interface IngestResult {
  rows: TelemetryRecord[];
  inserted: number;
}

export function ingestTelemetry(workspaceId: string, input: IngestTelemetryInput | IngestTelemetryInput[]): IngestResult {
  const records = Array.isArray(input) ? input : [input];
  if (records.length === 0) {
    throw new Error("Telemetry batch must contain at least one record.");
  }
  if (records.length > 500) {
    throw new Error("Telemetry batch cannot contain more than 500 records.");
  }

  const normalized = records.map((r) => normalizeTelemetryInput(workspaceId, r));

  const inserted = normalized.length === 1
    ? [insertTelemetry(normalized[0] as Omit<TelemetryRecord, "id">)]
    : insertTelemetryBatch(normalized as Array<Omit<TelemetryRecord, "id">>);

  for (const row of inserted) {
    telemetryBus.emitTelemetry(row);
  }
  invalidateAnalyticsCache(workspaceId);

  return {
    rows: inserted,
    inserted: inserted.length
  };
}

export function validateTelemetryPayload(payload: unknown): IngestTelemetryInput[] {
  if (Array.isArray(payload)) {
    return payload.map(validateSingleRecord);
  }

  if (!isPlainObject(payload)) {
    throw new Error("Telemetry payload must be an object or array of objects.");
  }

  if (Array.isArray((payload as { data?: unknown }).data)) {
    return ((payload as { data: unknown[] }).data).map((item) => validateSingleRecord(item as Record<string, unknown>));
  }

  if (Array.isArray((payload as { requests?: unknown }).requests)) {
    return ((payload as { requests: unknown[] }).requests).map((item) => validateSingleRecord(item as Record<string, unknown>));
  }

  return [validateSingleRecord(payload as Record<string, unknown>)];
}

function validateSingleRecord(payload: Record<string, unknown>): IngestTelemetryInput {
  if (!isPlainObject(payload)) {
    throw new Error("Telemetry records must be objects.");
  }

  const route = normalizeText(payload.route ?? payload.endpoint, "/unknown", 180);
  const model = normalizeText(payload.model, "unknown", 120);
  const provider = normalizeText(payload.provider, "unknown", 80);

  return {
    timestamp: Number.isFinite(Number(payload.timestamp)) ? Number(payload.timestamp) : Date.now(),
    event: payload.event === undefined ? undefined : normalizeText(payload.event, "", 160),
    projectId: payload.projectId === undefined ? undefined : normalizeText(payload.projectId, "", 160),
    route,
    endpoint: route,
    model,
    provider,
    input_tokens: normalizeNumber(payload.input_tokens),
    output_tokens: normalizeNumber(payload.output_tokens),
    total_tokens: normalizeNumber(payload.total_tokens),
    cost_usd: normalizeFloat(payload.cost_usd),
    latency_ms: normalizeNumber(payload.latency_ms),
    error: payload.error === undefined ? null : payload.error === null ? null : normalizeText(payload.error, "", 300),
    identity: isPlainObject(payload.identity)
      ? {
          id: String(payload.identity.id ?? "anonymous"),
          ...(isPlainObject(payload.identity.traits) ? { traits: { ...payload.identity.traits } } : {})
        }
      : null,
    properties: isPlainObject(payload.properties) ? { ...payload.properties } : undefined
  } as IngestTelemetryInput;
}

function normalizeTelemetryInput(workspaceId: string, record: IngestTelemetryInput): Omit<TelemetryRecord, "id"> {
  const metadata = buildMetadata(record);

  return {
    workspace_id: workspaceId,
    timestamp: record.timestamp ?? Date.now(),
    route: record.route ?? record.endpoint ?? "/unknown",
    model: record.model ?? "unknown",
    provider: record.provider ?? "unknown",
    input_tokens: record.input_tokens ?? 0,
    output_tokens: record.output_tokens ?? 0,
    total_tokens: record.total_tokens ?? (record.input_tokens ?? 0) + (record.output_tokens ?? 0),
    cost_usd: record.cost_usd ?? 0,
    latency_ms: record.latency_ms ?? 0,
    error: record.error ?? null,
    metadata
  };
}

function buildMetadata(record: IngestTelemetryInput): string | null {
  const metadata: Record<string, unknown> = {};

  if (record.event) {
    metadata.event = record.event;
  }
  if (record.projectId) {
    metadata.projectId = record.projectId;
  }
  if (record.identity) {
    metadata.identity = record.identity;
  }
  if (record.properties) {
    metadata.properties = record.properties;
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function normalizeFloat(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value ?? fallback).trim() || fallback;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

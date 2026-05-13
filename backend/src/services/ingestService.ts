import { telemetryBus } from "./telemetryBus";
import { insertTelemetry, insertTelemetryBatch } from "./telemetryRepository";
import type { TelemetryRecord } from "../types/telemetry";
import type { IngestTelemetryInput } from "../types/ingest";

export interface IngestResult {
  rows: TelemetryRecord[];
  inserted: number;
}

export function ingestTelemetry(workspaceId: string, input: IngestTelemetryInput | IngestTelemetryInput[]): IngestResult {
  const records = Array.isArray(input) ? input : [input];
  const normalized = records.map((r) => normalizeTelemetryInput(workspaceId, r));

  const inserted = normalized.length === 1
    ? [insertTelemetry(normalized[0] as Omit<TelemetryRecord, "id">)]
    : insertTelemetryBatch(normalized as Array<Omit<TelemetryRecord, "id">>);

  for (const row of inserted) {
    telemetryBus.emitTelemetry(row);
  }

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

  return [validateSingleRecord(payload as Record<string, unknown>)];
}

function validateSingleRecord(payload: Record<string, unknown>): IngestTelemetryInput {
  const route = String(payload.route ?? "/api/chat");
  const model = String(payload.model ?? "gpt-4o-mini");
  const provider = String(payload.provider ?? "OpenAI");

  return {
    timestamp: Number.isFinite(Number(payload.timestamp)) ? Number(payload.timestamp) : Date.now(),
    route,
    model,
    provider,
    input_tokens: normalizeNumber(payload.input_tokens),
    output_tokens: normalizeNumber(payload.output_tokens),
    total_tokens: normalizeNumber(payload.total_tokens),
    cost_usd: normalizeFloat(payload.cost_usd),
    latency_ms: normalizeNumber(payload.latency_ms),
    error: payload.error === undefined ? null : payload.error === null ? null : String(payload.error),
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
  return {
    workspace_id: workspaceId,
    timestamp: record.timestamp ?? Date.now(),
    route: (record.route ?? "/api/chat") as TelemetryRecord["route"],
    model: (record.model ?? "gpt-4o-mini") as TelemetryRecord["model"],
    provider: (record.provider ?? "OpenAI") as TelemetryRecord["provider"],
    input_tokens: record.input_tokens ?? 0,
    output_tokens: record.output_tokens ?? 0,
    total_tokens: record.total_tokens ?? (record.input_tokens ?? 0) + (record.output_tokens ?? 0),
    cost_usd: record.cost_usd ?? 0,
    latency_ms: record.latency_ms ?? 0,
    error: record.error ?? null
  };
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function normalizeFloat(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
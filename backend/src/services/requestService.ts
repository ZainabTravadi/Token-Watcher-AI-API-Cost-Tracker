import type { CreateRequestRecordInput, RequestRecord } from "../types/requests";
import { insertTelemetry, listLatestTelemetry } from "./telemetryRepository";
import type { TelemetryRecord } from "../types/telemetry";

export function recordRequest(input: CreateRequestRecordInput): RequestRecord {
  return insertTelemetry({
    timestamp: input.timestamp,
    route: input.route,
    model: input.model,
    provider: input.provider,
    input_tokens: input.input_tokens ?? 0,
    output_tokens: input.output_tokens ?? 0,
    total_tokens: input.total_tokens ?? 0,
    cost_usd: input.cost_usd ?? 0,
    latency_ms: input.latency_ms ?? 0,
    error: input.error ?? null
  } as unknown as Omit<TelemetryRecord, "id">);
}

export function listLatestRequests(limit = 100): RequestRecord[] {
  return listLatestTelemetry(limit);
}
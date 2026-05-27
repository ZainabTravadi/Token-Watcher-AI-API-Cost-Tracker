import type { CreateRequestRecordInput, RequestRecord } from "../types/requests";
import { insertTelemetry, listLatestTelemetry, listRequestLog } from "./telemetryRepository";
import type { TelemetryRecord } from "../types/telemetry";

export function recordRequest(workspaceId: string, input: CreateRequestRecordInput): RequestRecord {
  return insertTelemetry({
    workspace_id: workspaceId,
    timestamp: input.timestamp,
    route: input.route,
    model: input.model,
    provider: input.provider,
    input_tokens: input.input_tokens ?? 0,
    output_tokens: input.output_tokens ?? 0,
    total_tokens: input.total_tokens ?? 0,
    cost_usd: input.cost_usd ?? 0,
    latency_ms: input.latency_ms ?? 0,
    error: input.error ?? null,
    metadata: input.metadata ?? null
  } as unknown as Omit<TelemetryRecord, "id">);
}

export function listLatestRequests(workspaceId: string, limit = 100): RequestRecord[] {
  return listLatestTelemetry(workspaceId, limit);
}

export function listRequestLogRecords(workspaceId: string, options: Parameters<typeof listRequestLog>[1] = {}) {
  return listRequestLog(workspaceId, options);
}

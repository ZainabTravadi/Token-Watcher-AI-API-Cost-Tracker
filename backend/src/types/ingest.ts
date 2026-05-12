import type { TelemetryModel, TelemetryProvider, TelemetryRoute, TelemetryRecord } from "./telemetry";

export interface IngestTelemetryInput {
  timestamp?: number;
  route?: string;
  model?: string;
  provider?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  error?: string | null;
  projectId?: string;
  event?: string;
  identity?: { id: string; traits?: Record<string, unknown> } | null;
  properties?: Record<string, unknown>;
}

export interface IngestBatchPayload {
  data: IngestTelemetryInput[];
}

export interface IngestResponse {
  ok: true;
  inserted: number;
  rows: TelemetryRecord[];
}

export function isTelemetryProvider(value: string): value is TelemetryProvider {
  return value === "OpenAI" || value === "Anthropic";
}

export function isTelemetryModel(value: string): value is TelemetryModel {
  return value === "gpt-4o" || value === "gpt-4o-mini" || value === "claude-sonnet" || value === "claude-haiku";
}

export function isTelemetryRoute(value: string): value is TelemetryRoute {
  return value === "/api/chat" || value === "/api/summarize" || value === "/api/search" || value === "/api/autocomplete" || value === "/api/agents";
}
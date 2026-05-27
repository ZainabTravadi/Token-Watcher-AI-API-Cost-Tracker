import type { TelemetryRecord } from "./telemetry";

export interface IngestTelemetryInput {
  timestamp?: number;
  endpoint?: string;
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

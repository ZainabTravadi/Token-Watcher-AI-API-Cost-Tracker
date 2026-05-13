export type TelemetryProvider = "OpenAI" | "Anthropic";

export type TelemetryModel = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet" | "claude-haiku";

export type TelemetryRoute = "/api/chat" | "/api/summarize" | "/api/search" | "/api/autocomplete" | "/api/agents";

export interface TelemetryRecord {
  id: number;
  workspace_id: string;
  timestamp: number;
  route: TelemetryRoute;
  model: TelemetryModel;
  provider: TelemetryProvider;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  error: string | null;
}

export interface SimulatedTelemetryRecord extends Omit<TelemetryRecord, "id"> {}

export interface AnalyticsEndpointRow {
  route: TelemetryRoute;
  requests: number;
  cost_usd: number;
  avg_cost_usd: number;
  avg_latency_ms: number;
}

export interface AnalyticsModelRow {
  model: TelemetryModel;
  provider: TelemetryProvider;
  requests: number;
  tokens: number;
  cost_usd: number;
  avg_latency_ms: number;
}

export interface AnalyticsRecentRow {
  ts: string;
  endpoint: TelemetryRoute;
  model: TelemetryModel;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: "200" | "429" | "500";
}

export interface AnalyticsOverview {
  spendToday: number;
  requestsToday: number;
  avgCostPerRequest: number;
  budget: number;
  errorRate: number;
  errors429: number;
  errors500: number;
}

export interface AnalyticsSnapshot {
  overview: AnalyticsOverview;
  endpoints: AnalyticsEndpointRow[];
  models: AnalyticsModelRow[];
  recent: AnalyticsRecentRow[];
  timeline: Array<{ bucket: string; requests: number; cost_usd: number; latency_ms: number }>;
}
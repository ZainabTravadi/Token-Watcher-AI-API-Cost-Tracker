export type TokenWatchProvider = "openai" | "anthropic" | (string & {});

export interface TokenWatchInitOptions {
  apiKey: string;
  workspaceId: string;
  apiUrl: string;
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface TokenWatchIdentity {
  id: string;
  traits?: Record<string, unknown>;
}

export interface TokenWatchTrackOptions {
  timestamp?: number;
  properties?: Record<string, unknown>;
}

export interface TokenWatchTrackInput extends TokenWatchTrackOptions {
  name: string;
}

export interface TokenWatchSimulationOptions {
  provider?: TokenWatchProvider;
  model?: string;
  endpoint?: string;
  intervalMs?: number;
  jitterMs?: number;
  properties?: Record<string, unknown>;
}

export interface TokenWatchTelemetryRecord {
  id: string;
  workspace_id: string;
  timestamp: number;
  event: string;
  route: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  error: string | null;
  identity?: TokenWatchIdentity;
  properties?: Record<string, unknown>;
}


export interface TokenWatchStateSnapshot {
  apiUrl: string;
  apiKey: string;
  workspaceId: string;
  endpoint: string;
  headers: Record<string, string>;
  identity: TokenWatchIdentity | null;
}

export interface TokenWatchSimulationController {
  stop: () => void;
  running: boolean;
}
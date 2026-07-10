export type TokenWatchProvider = "openai" | "anthropic" | (string & {});

export interface TokenWatchInitOptions {
  apiKey: string;
  workspaceId?: string;
  apiUrl?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  maxQueueSize?: number;
  batchSize?: number;
  flushInterval?: number;
  retryAttempts?: number;
  requestTimeoutMs?: number;
  debug?: boolean;
}

export interface TokenWatchIdentity {
  id: string;
  traits?: Record<string, unknown>;
}

export interface TokenWatchTrackOptions {
  timestamp?: number;
  route?: string;
  endpoint?: string;
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  error?: string | null;
  properties?: Record<string, unknown>;
}

export interface TokenWatchTrackInput extends TokenWatchTrackOptions {
  name: string;
}

export interface TokenWatchSimulationOptions {
  provider?: TokenWatchProvider;
  model?: string;
  endpoint?: string;
  profile?: "low" | "medium" | "high";
  intervalMs?: number;
  jitterMs?: number;
  properties?: Record<string, unknown>;
}

export interface TokenWatchTransportStats {
  queueSize: number;
  maxQueueSize: number;
  inFlight: number;
  isFlushing: boolean;
  scheduled: boolean;
  flushes: number;
  retries: number;
  rejected: number;
  lastError: string | null;
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

export interface TokenWatchSignedHeaders {
  "X-TokenWatch-Workspace": string;
  "X-TokenWatch-Timestamp": string;
  "X-TokenWatch-Nonce": string;
  "X-TokenWatch-Signature": string;
}

export interface TokenWatchSimulationController {
  stop: () => void;
  running: boolean;
}

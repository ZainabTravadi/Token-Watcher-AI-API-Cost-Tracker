export interface RequestRecord {
  id: number;
  workspace_id: string;
  timestamp: number;
  route: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  error: string | null;
  metadata?: string | null;
}

export interface CreateRequestRecordInput {
  timestamp: number;
  route: string;
  model: string;
  provider: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  error?: string | null;
  metadata?: string | null;
}

export interface RequestLogQuery {
  page?: number;
  limit?: number;
  cursor?: string;
  route?: string;
  routes?: string[];
  model?: string[];
  provider?: string;
  providers?: string[];
  workspace?: string[];
  status?: string[];
  search?: string;
  from?: number;
  to?: number;
  minLatency?: number;
  maxLatency?: number;
  minCost?: number;
  maxCost?: number;
  minTokens?: number;
  maxTokens?: number;
  sortBy?: "timestamp" | "cost" | "latency" | "tokens" | "provider" | "model" | "endpoint" | "status";
  sortDir?: "asc" | "desc";
}

export interface RequestLogResponse {
  data: RequestRecord[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

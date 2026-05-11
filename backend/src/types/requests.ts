export interface RequestRecord {
  id: number;
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
}
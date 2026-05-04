export type EndpointRow = {
  path: string;
  requests: number;
  cost: number;
  avgCost: number;
  avgLatency: number;
};

export type ModelRow = {
  name: string;
  provider: string;
  requests: number;
  tokens: number;
  cost: number;
  avgLatency: number;
};

export type LogRow = {
  ts: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: "200" | "429" | "500";
};

export const endpoints: EndpointRow[] = [
  { path: "/api/chat", requests: 18432, cost: 142.81, avgCost: 0.00775, avgLatency: 842 },
  { path: "/api/summarize", requests: 6210, cost: 58.04, avgCost: 0.00935, avgLatency: 1240 },
  { path: "/api/search", requests: 12903, cost: 41.27, avgCost: 0.0032, avgLatency: 410 },
  { path: "/api/embed", requests: 92011, cost: 22.6, avgCost: 0.000246, avgLatency: 88 },
  { path: "/api/classify", requests: 4120, cost: 11.92, avgCost: 0.00289, avgLatency: 312 },
  { path: "/api/translate", requests: 1840, cost: 7.41, avgCost: 0.00403, avgLatency: 690 },
];

export const models: ModelRow[] = [
  { name: "gpt-4o", provider: "OpenAI", requests: 9201, tokens: 4_812_402, cost: 118.92, avgLatency: 920 },
  { name: "gpt-4o-mini", provider: "OpenAI", requests: 14820, tokens: 6_204_001, cost: 32.18, avgLatency: 410 },
  { name: "claude-3-5-sonnet", provider: "Anthropic", requests: 5310, tokens: 3_140_220, cost: 71.04, avgLatency: 1180 },
  { name: "claude-3-haiku", provider: "Anthropic", requests: 8120, tokens: 2_104_881, cost: 12.41, avgLatency: 380 },
  { name: "text-embedding-3-small", provider: "OpenAI", requests: 92011, tokens: 18_402_008, cost: 22.6, avgLatency: 88 },
  { name: "gemini-2.0-flash", provider: "Google", requests: 2104, tokens: 1_204_000, cost: 4.81, avgLatency: 510 },
];

export const logs: LogRow[] = [
  { ts: "2026-05-01 14:32:09", endpoint: "/api/chat", model: "gpt-4o", inputTokens: 842, outputTokens: 412, cost: 0.0124, status: "200" },
  { ts: "2026-05-01 14:32:04", endpoint: "/api/embed", model: "text-embedding-3-small", inputTokens: 1240, outputTokens: 0, cost: 0.000025, status: "200" },
  { ts: "2026-05-01 14:31:58", endpoint: "/api/summarize", model: "claude-3-5-sonnet", inputTokens: 3120, outputTokens: 612, cost: 0.0184, status: "200" },
  { ts: "2026-05-01 14:31:51", endpoint: "/api/chat", model: "gpt-4o-mini", inputTokens: 412, outputTokens: 220, cost: 0.0008, status: "200" },
  { ts: "2026-05-01 14:31:44", endpoint: "/api/search", model: "text-embedding-3-small", inputTokens: 92, outputTokens: 0, cost: 0.0000018, status: "200" },
  { ts: "2026-05-01 14:31:39", endpoint: "/api/chat", model: "gpt-4o", inputTokens: 1820, outputTokens: 980, cost: 0.0286, status: "200" },
  { ts: "2026-05-01 14:31:30", endpoint: "/api/classify", model: "claude-3-haiku", inputTokens: 240, outputTokens: 12, cost: 0.0002, status: "200" },
  { ts: "2026-05-01 14:31:22", endpoint: "/api/chat", model: "gpt-4o", inputTokens: 612, outputTokens: 0, cost: 0.0061, status: "429" },
  { ts: "2026-05-01 14:31:14", endpoint: "/api/translate", model: "gemini-2.0-flash", inputTokens: 412, outputTokens: 380, cost: 0.0021, status: "200" },
  { ts: "2026-05-01 14:31:08", endpoint: "/api/summarize", model: "claude-3-5-sonnet", inputTokens: 4210, outputTokens: 802, cost: 0.0241, status: "200" },
  { ts: "2026-05-01 14:30:59", endpoint: "/api/chat", model: "gpt-4o-mini", inputTokens: 280, outputTokens: 142, cost: 0.0006, status: "200" },
  { ts: "2026-05-01 14:30:51", endpoint: "/api/embed", model: "text-embedding-3-small", inputTokens: 1024, outputTokens: 0, cost: 0.000020, status: "200" },
  { ts: "2026-05-01 14:30:42", endpoint: "/api/chat", model: "gpt-4o", inputTokens: 980, outputTokens: 0, cost: 0.0098, status: "500" },
  { ts: "2026-05-01 14:30:30", endpoint: "/api/search", model: "text-embedding-3-small", inputTokens: 84, outputTokens: 0, cost: 0.0000017, status: "200" },
  { ts: "2026-05-01 14:30:18", endpoint: "/api/chat", model: "claude-3-5-sonnet", inputTokens: 2104, outputTokens: 1240, cost: 0.0331, status: "200" },
];

export const totals = {
  spendToday: 284.05,
  requestsToday: 135516,
  avgCostPerRequest: 0.0021,
  budget: 500,
};

export const fmtUSD = (n: number) =>
  n < 0.01
    ? `$${n.toFixed(6)}`
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number) => n.toLocaleString("en-US");

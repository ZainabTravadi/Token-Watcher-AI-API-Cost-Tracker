export const createRequestsTableSql = `
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  route TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
`;

export const createRequestsTimestampIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests (timestamp);
`;

export const createRequestsRouteIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_route ON requests (route);
`;
export const createUsersTableSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_logout_at INTEGER NOT NULL DEFAULT 0
);
`;

export const createWorkspacesTableSql = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  monthly_budget REAL NOT NULL DEFAULT 100,
  webhook_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

export const createApiKeysTableSql = `
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
`;

export const createWorkspaceSettingsTableSql = `
CREATE TABLE IF NOT EXISTS workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  alert_on_high_cost BOOLEAN NOT NULL DEFAULT 1,
  alert_on_errors BOOLEAN NOT NULL DEFAULT 1,
  alert_cost_threshold REAL NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
`;

export const createRequestsTableSql = `
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  route TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
`;

export const createRequestsTimestampIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests (timestamp);
`;

export const createRequestsWorkspaceTimestampIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_workspace_timestamp ON requests (workspace_id, timestamp DESC, id DESC);
`;

export const createRequestsRouteIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_route ON requests (route);
`;

export const createRequestsWorkspaceRouteTimestampIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_workspace_route_timestamp ON requests (workspace_id, route, timestamp DESC, id DESC);
`;

export const createRequestsWorkspaceModelTimestampIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_workspace_model_timestamp ON requests (workspace_id, model, timestamp DESC, id DESC);
`;

export const createRequestsWorkspaceErrorTimestampIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_workspace_error_timestamp ON requests (workspace_id, error, timestamp DESC);
`;

export const createRequestsWorkspaceIndexSql = `
CREATE INDEX IF NOT EXISTS idx_requests_workspace_id ON requests (workspace_id);
`;

export const createUsersEmailIndexSql = `
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
`;

export const createWorkspacesUserIdIndexSql = `
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces (user_id);
`;

export const createApiKeysWorkspaceIdIndexSql = `
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys (workspace_id);
`;

export const createApiKeysHashActiveIndexSql = `
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active ON api_keys (key_hash, revoked_at);
`;

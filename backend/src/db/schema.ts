export const createUsersTableSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_logout_at BIGINT NOT NULL DEFAULT 0
);
`;

export const createWorkspacesTableSql = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  monthly_budget DOUBLE PRECISION NOT NULL DEFAULT 100,
  webhook_url TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

export const createApiKeysTableSql = `
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Default SDK key',
  type TEXT NOT NULL DEFAULT 'SDK',
  permissions JSONB NOT NULL DEFAULT '["telemetry:ingest"]'::jsonb,
  created_by TEXT,
  created_at BIGINT NOT NULL,
  last_used_at BIGINT,
  expires_at BIGINT,
  revoked_at BIGINT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
`;

export const createWorkspaceSettingsTableSql = `
CREATE TABLE IF NOT EXISTS workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  alert_on_high_cost BOOLEAN NOT NULL DEFAULT true,
  alert_on_errors BOOLEAN NOT NULL DEFAULT true,
  alert_on_latency BOOLEAN NOT NULL DEFAULT false,
  daily_digest BOOLEAN NOT NULL DEFAULT false,
  weekly_report BOOLEAN NOT NULL DEFAULT true,
  alert_cost_threshold DOUBLE PRECISION NOT NULL DEFAULT 50,
  latency_threshold_ms INTEGER NOT NULL DEFAULT 2000,
  notification_email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  last_digest_sent BIGINT,
  last_weekly_report_sent BIGINT,
  last_test_email_sent BIGINT,
  last_high_cost_alert_sent BIGINT,
  last_error_alert_sent BIGINT,
  last_latency_alert_sent BIGINT,
  daily_digest_time TEXT NOT NULL DEFAULT '09:00',
  digest_timezone TEXT NOT NULL DEFAULT 'UTC',
  weekly_report_day TEXT NOT NULL DEFAULT 'Monday',
  weekly_report_time TEXT NOT NULL DEFAULT '08:00',
  webhook_last_test_at BIGINT,
  webhook_last_status TEXT,
  webhook_last_response_code INTEGER,
  webhook_last_response_time_ms INTEGER,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
`;

export const createRequestsTableSql = `
CREATE TABLE IF NOT EXISTS requests (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  route TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB,
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

export const createApiKeysExpiresAtIndexSql = `
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys (expires_at);
`;

export const createApiKeysRevokedAtIndexSql = `
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys (revoked_at);
`;

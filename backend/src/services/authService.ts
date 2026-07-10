import { getConfig } from "../config/env";
import { getDatabase } from "../db/database";
import { generateApiKey, generateId, hashApiKey, hashPassword, verifyPassword } from "../utils/auth";
import { timingSafeEqual } from "node:crypto";

export interface User {
  id: string;
  email: string;
  created_at: number;
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  monthly_budget: number;
  webhook_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface WorkspaceSettings {
  id: string;
  workspace_id: string;
  alert_on_high_cost: boolean;
  alert_on_errors: boolean;
  alert_on_latency: boolean;
  daily_digest: boolean;
  weekly_report: boolean;
  alert_cost_threshold: number;
  latency_threshold_ms: number;
  notification_email: string | null;
  email_verified: boolean;
  last_digest_sent: number | null;
  last_weekly_report_sent: number | null;
  last_test_email_sent: number | null;
  last_high_cost_alert_sent: number | null;
  last_error_alert_sent: number | null;
  last_latency_alert_sent: number | null;
  daily_digest_time: string;
  digest_timezone: string;
  weekly_report_day: string;
  weekly_report_time: string;
  webhook_last_test_at: number | null;
  webhook_last_status: string | null;
  webhook_last_response_code: number | null;
  webhook_last_response_time_ms: number | null;
  created_at?: number;
  updated_at: number;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  label: string;
  type: ApiKeyType;
  permissions: ApiKeyPermission[];
  created_by: string | null;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
  revoked_at: number | null;
  last_rotated_at?: number | null;
}

export type ApiKeyType = "SDK" | "OPENCLAW" | "CI" | "READONLY" | "ADMIN" | "SERVICE";

export type ApiKeyPermission =
  | "telemetry:ingest"
  | "workspace:read"
  | "analytics:read"
  | "requests:read"
  | "reports:read"
  | "recommendations:read"
  | "forecast:read"
  | "copilot:use"
  | "admin:all";

export interface ApiKeyIdentity {
  keyId: string;
  workspaceId: string;
  ownerId: string;
  workspace: Workspace;
  type: ApiKeyType;
  permissions: ApiKeyPermission[];
  label: string;
  expiresAt: number | null;
}

export interface CreateWorkspaceApiKeyInput {
  workspaceId: string;
  createdBy: string | null;
  label?: string;
  type?: ApiKeyType;
  permissions?: ApiKeyPermission[];
  expiresAt?: number | null;
}

export interface WorkspaceCreationResult {
  workspace: Workspace;
  apiKey: string;
}

const API_KEY_TYPES = new Set<ApiKeyType>(["SDK", "OPENCLAW", "CI", "READONLY", "ADMIN", "SERVICE"]);
const API_KEY_PREFIX_BY_TYPE: Record<ApiKeyType, string> = {
  SDK: "tw_sdk_",
  OPENCLAW: "tw_oc_",
  CI: "tw_ci_",
  READONLY: "tw_ro_",
  ADMIN: "tw_admin_",
  SERVICE: "tw_service_"
};
const API_KEY_TYPE_BY_PREFIX = new Map(Object.entries(API_KEY_PREFIX_BY_TYPE).map(([type, prefix]) => [prefix, type as ApiKeyType]));
const API_KEY_LAST_USED_WRITE_INTERVAL_MS = 60_000;
const API_KEY_PERMISSIONS = new Set<ApiKeyPermission>([
  "telemetry:ingest",
  "workspace:read",
  "analytics:read",
  "requests:read",
  "reports:read",
  "recommendations:read",
  "forecast:read",
  "copilot:use",
  "admin:all"
]);

export const DEFAULT_PERMISSIONS_BY_KEY_TYPE: Record<ApiKeyType, ApiKeyPermission[]> = {
  SDK: ["telemetry:ingest"],
  OPENCLAW: ["workspace:read", "analytics:read", "requests:read", "reports:read", "recommendations:read", "forecast:read", "copilot:use"],
  CI: ["telemetry:ingest", "analytics:read", "reports:read"],
  READONLY: ["workspace:read", "analytics:read", "requests:read", "reports:read", "recommendations:read", "forecast:read"],
  ADMIN: ["admin:all"],
  SERVICE: ["workspace:read", "analytics:read", "requests:read", "reports:read", "recommendations:read", "forecast:read", "copilot:use"]
};

const MAX_PERMISSIONS_BY_KEY_TYPE: Record<ApiKeyType, Set<ApiKeyPermission>> = Object.fromEntries(
  Object.entries(DEFAULT_PERMISSIONS_BY_KEY_TYPE).map(([type, permissions]) => [type, new Set(permissions)])
) as Record<ApiKeyType, Set<ApiKeyPermission>>;

export function normalizeApiKeyType(value: unknown): ApiKeyType {
  const candidate = typeof value === "string" ? value.trim().toUpperCase() : "SDK";
  return API_KEY_TYPES.has(candidate as ApiKeyType) ? candidate as ApiKeyType : "SDK";
}

export function normalizeApiKeyPermissions(type: ApiKeyType, value: unknown): ApiKeyPermission[] {
  const raw = Array.isArray(value) ? value : DEFAULT_PERMISSIONS_BY_KEY_TYPE[type];
  const allowed = MAX_PERMISSIONS_BY_KEY_TYPE[type];
  const permissions = raw.filter((permission): permission is ApiKeyPermission => (
    typeof permission === "string" &&
    API_KEY_PERMISSIONS.has(permission as ApiKeyPermission) &&
    allowed.has(permission as ApiKeyPermission)
  ));
  const deduped = [...new Set(permissions)];
  return deduped.length > 0 || Array.isArray(value) ? deduped : DEFAULT_PERMISSIONS_BY_KEY_TYPE[type];
}

export function hasApiKeyPermission(identity: Pick<ApiKeyIdentity, "permissions">, permission: ApiKeyPermission): boolean {
  return identity.permissions.includes("admin:all") || identity.permissions.includes(permission);
}

export function getApiKeyPrefix(type: ApiKeyType): string {
  return API_KEY_PREFIX_BY_TYPE[type];
}

export function readApiKeyTypeFromKey(plainKey: string): ApiKeyType | null {
  for (const [prefix, type] of API_KEY_TYPE_BY_PREFIX) {
    if (plainKey.startsWith(prefix)) {
      return type;
    }
  }
  return null;
}

/**
 * Create a new user account
 */
export async function createUser(email: string, password: string): Promise<User | null> {
  try {
    const db = getDatabase();
    const userId = generateId("user");
    const passwordHash = hashPassword(password);
    const now = Date.now();

    const stmt = db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    await stmt.run(userId, email.toLowerCase(), passwordHash, now, now);

    return { id: userId, email: email.toLowerCase(), created_at: now };
  } catch (error) {
    return null;
  }
}

/**
 * Find a user by email
 */
export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const row = await stmt.get<User & { password_hash: string }>(email.toLowerCase());
  return row ? normalizeUser(row) as User & { password_hash: string } : null;
}

/**
 * Find a user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const db = getDatabase();
  const stmt = db.prepare("SELECT id, email, created_at FROM users WHERE id = ?");
  const row = await stmt.get<User>(id);
  return row ? normalizeUser(row) : null;
}

export async function setUserLastLogoutAt(userId: string, timestamp: number): Promise<boolean> {
  try {
    const db = getDatabase();
    const stmt = db.prepare("UPDATE users SET last_logout_at = ? WHERE id = ?");
    const result = await stmt.run(timestamp, userId);
    return result.changes > 0;
  } catch (error) {
    return false;
  }
}

export async function getUserLastLogoutAt(userId: string): Promise<number> {
  const db = getDatabase();
  const stmt = db.prepare("SELECT last_logout_at FROM users WHERE id = ?");
  const row = await stmt.get<{ last_logout_at: number }>(userId);
  return Number(row?.last_logout_at ?? 0);
}

/**
 * Create a new workspace for a user
 */
export async function createWorkspace(userId: string, name: string): Promise<WorkspaceCreationResult | null> {
  try {
    const db = getDatabase();
    const creation = await db.transaction(async () => {
      const workspaceId = generateId("ws");
      const now = Date.now();
      const user = await db.prepare("SELECT email FROM users WHERE id = ?").get<{ email: string }>(userId);

      const wsStmt = db.prepare(
        "INSERT INTO workspaces (id, user_id, name, monthly_budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      );
      await wsStmt.run(workspaceId, userId, name, 100, now, now);

      const settingsId = generateId("wss");
      const settingsStmt = db.prepare(
        "INSERT INTO workspace_settings (id, workspace_id, alert_on_high_cost, alert_on_errors, alert_on_latency, daily_digest, weekly_report, alert_cost_threshold, latency_threshold_ms, notification_email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      await settingsStmt.run(settingsId, workspaceId, true, true, false, false, true, 50, 2000, user?.email?.toLowerCase() ?? null, false, now, now);

      const apiKeyId = generateId("key");
      const plainKey = generateApiKey(getApiKeyPrefix("SDK"));
      const keyHash = hashApiKey(plainKey);
      const keyStmt = db.prepare("INSERT INTO api_keys (id, workspace_id, key_hash, label, type, permissions, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      await keyStmt.run(apiKeyId, workspaceId, keyHash, "Default SDK key", "SDK", JSON.stringify(DEFAULT_PERMISSIONS_BY_KEY_TYPE.SDK), userId, now);

      return {
        workspace: { id: workspaceId, user_id: userId, name, monthly_budget: 100, webhook_url: null, created_at: now, updated_at: now },
        apiKey: plainKey
      };
    });

    if (getConfig().enableSimulators) {
      // Start simulator for this workspace (async to not block signup)
      try {
        const { startWorkspaceSimulator } = require("./workspaceSimulatorManager");
        setImmediate(() => startWorkspaceSimulator(creation.workspace.id));
      } catch (error) {
        // Simulator startup is not critical for workspace creation
        console.warn(`[createWorkspace] Failed to start simulator:`, error);
      }
    }

    return creation;
  } catch (error) {
    console.error(`[createWorkspace] Error creating workspace for user ${userId}:`, error);
    return null;
  }
}

/**
 * Get all workspaces for a user
 */
export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at DESC");
  return (await stmt.all<Workspace>(userId)).map(normalizeWorkspace);
}

/**
 * Get a workspace by ID (with user ownership check)
 */
export async function getWorkspace(workspaceId: string, userId?: string): Promise<Workspace | null> {
  const db = getDatabase();
  let stmt;
  let params: any[];

  if (userId) {
    stmt = db.prepare("SELECT * FROM workspaces WHERE id = ? AND user_id = ?");
    params = [workspaceId, userId];
  } else {
    stmt = db.prepare("SELECT * FROM workspaces WHERE id = ?");
    params = [workspaceId];
  }

  const row = await stmt.get<Workspace>(...params);
  return row ? normalizeWorkspace(row) : null;
}

/**
 * Update workspace settings
 */
export async function updateWorkspaceSettings(
  workspaceId: string,
  updates: Partial<Omit<WorkspaceSettings, "id" | "workspace_id" | "created_at">>
): Promise<WorkspaceSettings | null> {
  try {
    const db = getDatabase();
    const now = Date.now();

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = keys.map((k) => `${k} = ?`).join(", ");

    if (keys.length === 0) {
      return await getWorkspaceSettings(workspaceId);
    }

    const stmt = db.prepare(`UPDATE workspace_settings SET ${setClauses}, updated_at = ? WHERE workspace_id = ?`);
    await stmt.run(...values, now, workspaceId);
    invalidateWorkspaceCaches(workspaceId);

    const selectStmt = db.prepare("SELECT * FROM workspace_settings WHERE workspace_id = ?");
    const row = await selectStmt.get<WorkspaceSettings>(workspaceId);
    return row ? normalizeWorkspaceSettings(row) : null;
  } catch (error) {
    console.error("[updateWorkspaceSettings:error]", error);
    return null;
  }
}

/**
 * Get workspace settings
 */
export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM workspace_settings WHERE workspace_id = ?");
  const row = await stmt.get<WorkspaceSettings>(workspaceId);
  return row ? normalizeWorkspaceSettings(row) : null;
}

/**
 * Generate a new API key for a workspace
 */
export async function generateWorkspaceApiKey(input: string | CreateWorkspaceApiKeyInput): Promise<string> {
  const db = getDatabase();
  const now = Date.now();
  const options: CreateWorkspaceApiKeyInput = typeof input === "string"
    ? { workspaceId: input, createdBy: null, type: "SDK" }
    : input;
  const type = normalizeApiKeyType(options.type);
  const permissions = normalizeApiKeyPermissions(type, options.permissions);
  const label = normalizeApiKeyLabel(options.label, `${type} key`);
  const expiresAt = options.expiresAt === null || options.expiresAt === undefined ? null : Number(options.expiresAt);

  const stmt = db.prepare("INSERT INTO api_keys (id, workspace_id, key_hash, label, type, permissions, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const apiKeyId = generateId("key");
    const plainKey = generateApiKey(getApiKeyPrefix(type));
    const keyHash = hashApiKey(plainKey);
    try {
      await stmt.run(apiKeyId, options.workspaceId, keyHash, label, type, JSON.stringify(permissions), options.createdBy, now, Number.isFinite(expiresAt) ? expiresAt : null);
      console.info(`[api-key:create] workspace=${options.workspaceId} key=${apiKeyId} type=${type} created_by=${options.createdBy ?? "system"}`);
      return plainKey;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("Unable to create API key");
}

export async function listWorkspaceApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const db = getDatabase();
  const stmt = db.prepare("SELECT id, workspace_id, label, type, permissions, created_by, created_at, last_used_at, expires_at, revoked_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC");
  return (await stmt.all<ApiKey>(workspaceId)).map(normalizeApiKey);
}

/**
 * Get active API key for a workspace (only one active key per workspace)
 */
export async function getWorkspaceApiKey(workspaceId: string): Promise<ApiKey | null> {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM api_keys WHERE workspace_id = ? AND revoked_at IS NULL AND type = 'SDK' ORDER BY created_at DESC LIMIT 1");
  const row = await stmt.get<ApiKey>(workspaceId);
  if (!row) return null;
  const normalized = normalizeApiKey(row);
  normalized.last_rotated_at = await getWorkspaceApiKeyLastRotatedAt(workspaceId);
  return normalized;
}

export async function getWorkspaceApiKeyLastRotatedAt(workspaceId: string): Promise<number | null> {
  const db = getDatabase();
  const row = await db.prepare("SELECT MAX(revoked_at) AS last_rotated_at FROM api_keys WHERE workspace_id = ? AND revoked_at IS NOT NULL")
    .get<{ last_rotated_at: string | number | null }>(workspaceId);
  return row?.last_rotated_at === null || row?.last_rotated_at === undefined ? null : Number(row.last_rotated_at);
}

/**
 * Verify an API key and return the workspace ID if valid
 */
export async function verifyApiKey(plainKey: string): Promise<ApiKeyIdentity | null> {
  try {
    const declaredType = readApiKeyTypeFromKey(plainKey);
    if (!declaredType || plainKey.length < getApiKeyPrefix(declaredType).length + 64) {
      return null;
    }

    const db = getDatabase();
    const keyHash = hashApiKey(plainKey);

    const stmt = db.prepare(
      `SELECT
         api_keys.id AS api_key_id,
         api_keys.workspace_id,
         api_keys.key_hash,
         api_keys.label,
         api_keys.type,
         api_keys.permissions,
         api_keys.last_used_at,
         api_keys.expires_at,
         workspaces.id AS workspace_row_id,
         workspaces.user_id,
         workspaces.name,
         workspaces.monthly_budget,
         workspaces.webhook_url,
         workspaces.created_at,
         workspaces.updated_at
       FROM api_keys
       JOIN workspaces ON api_keys.workspace_id = workspaces.id
       WHERE api_keys.key_hash = ? AND api_keys.revoked_at IS NULL`
    );

    const result = await stmt.get<any>(keyHash);
    if (!result) {
      return null;
    }
    if (!safeEqualHex(keyHash, result.key_hash)) {
      return null;
    }
    const expiresAt = result.expires_at === null || result.expires_at === undefined ? null : Number(result.expires_at);
    if (expiresAt !== null && expiresAt <= Date.now()) {
      return null;
    }

    const storedType = normalizeApiKeyType(result.type);
    if (storedType !== declaredType) {
      return null;
    }

    const workspace: Workspace = {
      id: result.workspace_row_id,
      user_id: result.user_id,
      name: result.name,
      monthly_budget: Number(result.monthly_budget),
      webhook_url: result.webhook_url,
      created_at: Number(result.created_at),
      updated_at: Number(result.updated_at),
    };

    updateApiKeyLastUsedSoon(result.api_key_id, Number(result.last_used_at ?? 0));

    return {
      keyId: result.api_key_id,
      workspaceId: result.workspace_id,
      ownerId: result.user_id,
      workspace,
      type: storedType,
      permissions: normalizeApiKeyPermissions(storedType, parsePermissions(result.permissions)),
      label: String(result.label ?? "API key"),
      expiresAt
    };
  } catch (error) {
    return null;
  }
}

/**
 * Regenerate API key (revoke old, create new)
 */
export async function regenerateWorkspaceApiKey(workspaceId: string): Promise<string | null> {
  try {
    const db = getDatabase();
    return await db.transaction(async () => {
      const apiKeyId = generateId("key");
      const plainKey = generateApiKey(getApiKeyPrefix("SDK"));
      const keyHash = hashApiKey(plainKey);
      const now = Date.now();

      const revokeStmt = db.prepare("UPDATE api_keys SET revoked_at = ? WHERE workspace_id = ? AND revoked_at IS NULL AND type = 'SDK'");
      await revokeStmt.run(now, workspaceId);

      const insertStmt = db.prepare("INSERT INTO api_keys (id, workspace_id, key_hash, label, type, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
      await insertStmt.run(apiKeyId, workspaceId, keyHash, "Default SDK key", "SDK", JSON.stringify(DEFAULT_PERMISSIONS_BY_KEY_TYPE.SDK), now);

      return plainKey;
    });

  } catch (error) {
    return null;
  }
}

export async function revokeWorkspaceApiKey(workspaceId: string, keyId: string): Promise<boolean> {
  const db = getDatabase();
  const result = await db.prepare("UPDATE api_keys SET revoked_at = ? WHERE workspace_id = ? AND id = ? AND revoked_at IS NULL")
    .run(Date.now(), workspaceId, keyId);
  if (result.changes > 0) {
    console.info(`[api-key:revoke] workspace=${workspaceId} key=${keyId}`);
  }
  return result.changes > 0;
}

function updateApiKeyLastUsedSoon(keyId: string, previousLastUsedAt: number): void {
  const now = Date.now();
  if (previousLastUsedAt && now - previousLastUsedAt < API_KEY_LAST_USED_WRITE_INTERVAL_MS) {
    return;
  }
  setImmediate(() => {
    const db = getDatabase();
    void db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ? AND (last_used_at IS NULL OR last_used_at < ?)")
      .run(now, keyId, now - API_KEY_LAST_USED_WRITE_INTERVAL_MS)
      .catch((error) => console.warn(`[api-key:last-used:error] key=${keyId} ${error instanceof Error ? error.message : String(error)}`));
  });
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * Update workspace settings (budget, webhook, name)
 */
export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  updates: Partial<Pick<Workspace, "name" | "monthly_budget" | "webhook_url">>
): Promise<Workspace | null> {
  try {
    const db = getDatabase();
    const now = Date.now();

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = keys.map((k) => `${k} = ?`).join(", ");

    if (keys.length === 0) {
      return await getWorkspace(workspaceId, userId);
    }

    const stmt = db.prepare(
      `UPDATE workspaces SET ${setClauses}, updated_at = ? WHERE id = ? AND user_id = ?`
    );
    await stmt.run(...values, now, workspaceId, userId);
    invalidateWorkspaceCaches(workspaceId);

    return await getWorkspace(workspaceId, userId);
  } catch (error) {
    return null;
  }
}

function invalidateWorkspaceCaches(workspaceId: string): void {
  try {
    const { invalidateAnalyticsCache } = require("./analyticsCache");
    invalidateAnalyticsCache(workspaceId);
  } catch {
    // Cache invalidation is best effort; reads remain correct after TTL.
  }
}

function normalizeUser<T extends User>(row: T): T {
  return {
    ...row,
    created_at: Number(row.created_at)
  };
}

function normalizeWorkspace(row: Workspace): Workspace {
  return {
    ...row,
    monthly_budget: Number(row.monthly_budget),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at)
  };
}

function normalizeWorkspaceSettings(row: WorkspaceSettings): WorkspaceSettings {
  const normalized: WorkspaceSettings = {
    ...row,
    alert_on_high_cost: Boolean(row.alert_on_high_cost),
    alert_on_errors: Boolean(row.alert_on_errors),
    alert_on_latency: Boolean(row.alert_on_latency),
    daily_digest: Boolean(row.daily_digest),
    weekly_report: Boolean(row.weekly_report),
    alert_cost_threshold: Number(row.alert_cost_threshold),
    latency_threshold_ms: Number(row.latency_threshold_ms ?? 2000),
    notification_email: row.notification_email ?? null,
    email_verified: Boolean(row.email_verified),
    last_digest_sent: row.last_digest_sent === null || row.last_digest_sent === undefined ? null : Number(row.last_digest_sent),
    last_weekly_report_sent: row.last_weekly_report_sent === null || row.last_weekly_report_sent === undefined ? null : Number(row.last_weekly_report_sent),
    last_test_email_sent: row.last_test_email_sent === null || row.last_test_email_sent === undefined ? null : Number(row.last_test_email_sent),
    last_high_cost_alert_sent: row.last_high_cost_alert_sent === null || row.last_high_cost_alert_sent === undefined ? null : Number(row.last_high_cost_alert_sent),
    last_error_alert_sent: row.last_error_alert_sent === null || row.last_error_alert_sent === undefined ? null : Number(row.last_error_alert_sent),
    last_latency_alert_sent: row.last_latency_alert_sent === null || row.last_latency_alert_sent === undefined ? null : Number(row.last_latency_alert_sent),
    daily_digest_time: row.daily_digest_time ?? "09:00",
    digest_timezone: row.digest_timezone ?? "UTC",
    weekly_report_day: row.weekly_report_day ?? "Monday",
    weekly_report_time: row.weekly_report_time ?? "08:00",
    webhook_last_test_at: row.webhook_last_test_at === null || row.webhook_last_test_at === undefined ? null : Number(row.webhook_last_test_at),
    webhook_last_status: row.webhook_last_status ?? null,
    webhook_last_response_code: row.webhook_last_response_code === null || row.webhook_last_response_code === undefined ? null : Number(row.webhook_last_response_code),
    webhook_last_response_time_ms: row.webhook_last_response_time_ms === null || row.webhook_last_response_time_ms === undefined ? null : Number(row.webhook_last_response_time_ms),
    updated_at: Number(row.updated_at)
  };
  if (row.created_at !== undefined) {
    normalized.created_at = Number(row.created_at);
  }
  return normalized;
}

function normalizeApiKey(row: ApiKey): ApiKey {
  return {
    ...row,
    label: row.label ?? "API key",
    type: normalizeApiKeyType(row.type),
    permissions: normalizeApiKeyPermissions(normalizeApiKeyType(row.type), parsePermissions(row.permissions)),
    created_by: row.created_by ?? null,
    created_at: Number(row.created_at),
    last_used_at: row.last_used_at === null || row.last_used_at === undefined ? null : Number(row.last_used_at),
    expires_at: row.expires_at === null || row.expires_at === undefined ? null : Number(row.expires_at),
    revoked_at: row.revoked_at === null || row.revoked_at === undefined ? null : Number(row.revoked_at)
  };
}

function normalizeApiKeyLabel(value: unknown, fallback: string): string {
  const label = typeof value === "string" ? value.trim() : "";
  return (label || fallback).slice(0, 120);
}

function parsePermissions(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Delete a workspace (cascade deletes all associated data)
 */
export async function deleteWorkspace(workspaceId: string, userId: string): Promise<boolean> {
  try {
    const db = getDatabase();
    const stmt = db.prepare("DELETE FROM workspaces WHERE id = ? AND user_id = ?");
    const result = await stmt.run(workspaceId, userId);

    // Stop simulator if it's running
    if (result.changes > 0) {
      try {
        const { invalidateAnalyticsCache } = require("./analyticsCache");
        invalidateAnalyticsCache(workspaceId);
      } catch (error) {
        // Cache cleanup is best effort; database deletion is authoritative.
      }
      try {
        const { stopWorkspaceSimulator } = require("./workspaceSimulatorManager");
        stopWorkspaceSimulator(workspaceId);
      } catch (error) {
        // Simulator cleanup is not critical
        console.warn(`[deleteWorkspace] Failed to stop simulator:`, error);
      }
    }

    return result.changes > 0;
  } catch (error) {
    return false;
  }
}

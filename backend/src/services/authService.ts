import { getDatabase } from "../db/database";
import { generateApiKey, generateId, hashApiKey, hashPassword, verifyPassword } from "../utils/auth";

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
  alert_cost_threshold: number;
  updated_at: number;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  created_at: number;
  revoked_at: number | null;
}

/**
 * Create a new user account
 */
export function createUser(email: string, password: string): User | null {
  try {
    const db = getDatabase();
    const userId = generateId("user");
    const passwordHash = hashPassword(password);
    const now = Date.now();

    const stmt = db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(userId, email.toLowerCase(), passwordHash, now, now);

    return { id: userId, email: email.toLowerCase(), created_at: now };
  } catch (error) {
    return null;
  }
}

/**
 * Find a user by email
 */
export function findUserByEmail(email: string): (User & { password_hash: string }) | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  return stmt.get(email.toLowerCase()) as (User & { password_hash: string }) | null;
}

/**
 * Find a user by ID
 */
export function findUserById(id: string): User | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT id, email, created_at FROM users WHERE id = ?");
  return stmt.get(id) as User | null;
}

/**
 * Create a new workspace for a user
 */
export function createWorkspace(userId: string, name: string): Workspace | null {
  try {
    const db = getDatabase();
    const workspaceId = generateId("ws");
    const now = Date.now();

    // Create workspace
    const wsStmt = db.prepare(
      "INSERT INTO workspaces (id, user_id, name, monthly_budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    wsStmt.run(workspaceId, userId, name, 100, now, now);

    // Create workspace settings
    const settingsId = generateId("wss");
    const settingsStmt = db.prepare(
      "INSERT INTO workspace_settings (id, workspace_id, alert_on_high_cost, alert_on_errors, alert_cost_threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    settingsStmt.run(settingsId, workspaceId, 1, 1, 50, now, now);

    // Generate API key for the workspace
    generateWorkspaceApiKey(workspaceId);

    // Start simulator for this workspace (async to not block signup)
    try {
      const { startWorkspaceSimulator } = require("./workspaceSimulatorManager");
      setImmediate(() => startWorkspaceSimulator(workspaceId));
    } catch (error) {
      // Simulator startup is not critical for workspace creation
      console.warn(`[createWorkspace] Failed to start simulator:`, error);
    }

    return { id: workspaceId, user_id: userId, name, monthly_budget: 100, webhook_url: null, created_at: now, updated_at: now };
  } catch (error) {
    console.error(`[createWorkspace] Error creating workspace for user ${userId}:`, error);
    return null;
  }
}

/**
 * Get all workspaces for a user
 */
export function getUserWorkspaces(userId: string): Workspace[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at DESC");
  return stmt.all(userId) as Workspace[];
}

/**
 * Get a workspace by ID (with user ownership check)
 */
export function getWorkspace(workspaceId: string, userId?: string): Workspace | null {
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

  return stmt.get(...params) as Workspace | null;
}

/**
 * Update workspace settings
 */
export function updateWorkspaceSettings(
  workspaceId: string,
  updates: Partial<Omit<WorkspaceSettings, "id" | "workspace_id" | "created_at">>
): WorkspaceSettings | null {
  try {
    const db = getDatabase();
    const now = Date.now();

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = keys.map((k) => `${k} = ?`).join(", ");

    const stmt = db.prepare(`UPDATE workspace_settings SET ${setClauses}, updated_at = ? WHERE workspace_id = ?`);
    stmt.run(...values, now, workspaceId);

    const selectStmt = db.prepare("SELECT * FROM workspace_settings WHERE workspace_id = ?");
    return selectStmt.get(workspaceId) as WorkspaceSettings | null;
  } catch (error) {
    return null;
  }
}

/**
 * Get workspace settings
 */
export function getWorkspaceSettings(workspaceId: string): WorkspaceSettings | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM workspace_settings WHERE workspace_id = ?");
  return stmt.get(workspaceId) as WorkspaceSettings | null;
}

/**
 * Generate a new API key for a workspace
 */
export function generateWorkspaceApiKey(workspaceId: string): string {
  const db = getDatabase();
  const apiKeyId = generateId("key");
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const now = Date.now();

  const stmt = db.prepare("INSERT INTO api_keys (id, workspace_id, key_hash, created_at) VALUES (?, ?, ?, ?)");
  stmt.run(apiKeyId, workspaceId, keyHash, now);

  return plainKey;
}

/**
 * Get active API key for a workspace (only one active key per workspace)
 */
export function getWorkspaceApiKey(workspaceId: string): ApiKey | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM api_keys WHERE workspace_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1");
  return stmt.get(workspaceId) as ApiKey | null;
}

/**
 * Verify an API key and return the workspace ID if valid
 */
export function verifyApiKey(plainKey: string): { workspaceId: string; workspace: Workspace } | null {
  try {
    const db = getDatabase();
    const keyHash = hashApiKey(plainKey);

    const stmt = db.prepare(
      `SELECT api_keys.workspace_id, workspaces.* FROM api_keys
       JOIN workspaces ON api_keys.workspace_id = workspaces.id
       WHERE api_keys.key_hash = ? AND api_keys.revoked_at IS NULL`
    );

    const result = stmt.get(keyHash) as any;
    if (!result) {
      return null;
    }

    const workspace: Workspace = {
      id: result.id,
      user_id: result.user_id,
      name: result.name,
      monthly_budget: result.monthly_budget,
      webhook_url: result.webhook_url,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };

    return { workspaceId: result.workspace_id, workspace };
  } catch (error) {
    return null;
  }
}

/**
 * Regenerate API key (revoke old, create new)
 */
export function regenerateWorkspaceApiKey(workspaceId: string): string | null {
  try {
    const db = getDatabase();
    const now = Date.now();

    // Revoke old keys
    const revokeStmt = db.prepare("UPDATE api_keys SET revoked_at = ? WHERE workspace_id = ? AND revoked_at IS NULL");
    revokeStmt.run(now, workspaceId);

    // Create new key
    return generateWorkspaceApiKey(workspaceId);
  } catch (error) {
    return null;
  }
}

/**
 * Update workspace settings (budget, webhook, name)
 */
export function updateWorkspace(
  workspaceId: string,
  userId: string,
  updates: Partial<Pick<Workspace, "name" | "monthly_budget" | "webhook_url">>
): Workspace | null {
  try {
    const db = getDatabase();
    const now = Date.now();

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = keys.map((k) => `${k} = ?`).join(", ");

    const stmt = db.prepare(
      `UPDATE workspaces SET ${setClauses}, updated_at = ? WHERE id = ? AND user_id = ?`
    );
    stmt.run(...values, now, workspaceId, userId);

    return getWorkspace(workspaceId, userId);
  } catch (error) {
    return null;
  }
}

/**
 * Delete a workspace (cascade deletes all associated data)
 */
export function deleteWorkspace(workspaceId: string, userId: string): boolean {
  try {
    const db = getDatabase();
    const stmt = db.prepare("DELETE FROM workspaces WHERE id = ? AND user_id = ?");
    const result = stmt.run(workspaceId, userId);

    // Stop simulator if it's running
    if (result.changes > 0) {
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

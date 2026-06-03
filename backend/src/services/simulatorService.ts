import { telemetryBus } from "./telemetryBus";
import { generateHistoricalDataset } from "./telemetryGenerator";
import {
  hasTelemetryRows,
  insertTelemetry,
  insertTelemetryBatch,
  getTelemetryCount
} from "./telemetryRepository";
import { getDatabase } from "../db/database";
import { generateApiKey, generateId, hashApiKey } from "../utils/auth";

export interface SimulatorState {
  enabled: boolean;
  running: boolean;
  seededRows: number;
  totalRows: number;
}

async function getDemoWorkspaceId(): Promise<string> {
  const db = getDatabase();
  
  // Check if demo workspace exists
  const existing = await db.prepare("SELECT id FROM workspaces WHERE name = 'Demo Workspace' LIMIT 1").get<{ id: string }>();
  if (existing) {
    return existing.id;
  }

  // Create demo workspace
  try {
    const workspaceId = generateId("ws");
    const demoUserId = generateId("user");
    const now = Date.now();

    // Create demo user with a dummy hash
    const dummyHash = "disabled"; // Demo user cannot login
    const userStmt = db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    await userStmt.run(demoUserId, "demo@tokenwatch.local", dummyHash, now, now);

    // Create demo workspace
    const wsStmt = db.prepare(
      "INSERT INTO workspaces (id, user_id, name, monthly_budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    await wsStmt.run(workspaceId, demoUserId, "Demo Workspace", 500, now, now);

    // Create workspace settings
    const settingsId = generateId("wss");
    const settingsStmt = db.prepare(
      "INSERT INTO workspace_settings (id, workspace_id, alert_on_high_cost, alert_on_errors, alert_cost_threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    await settingsStmt.run(settingsId, workspaceId, true, true, 50, now, now);

    // Create API key
    const apiKeyId = generateId("api_key");
    const keyStmt = db.prepare(
      "INSERT INTO api_keys (id, workspace_id, key_hash, created_at) VALUES (?, ?, ?, ?)"
    );
    await keyStmt.run(apiKeyId, workspaceId, hashApiKey(generateApiKey()), now);

    return workspaceId;
  } catch (error) {
    console.error("[simulator] Failed to create demo workspace:", error);
    throw error;
  }
}

export async function seedTelemetryDataset(force = false): Promise<number> {
  if (!force && await hasTelemetryRows()) {
    return 0;
  }

  const workspaceId = await getDemoWorkspaceId();
  const records = generateHistoricalDataset(workspaceId, 7);
  
  // Add workspace_id to all records
  const recordsWithWorkspace = records.map((r) => ({ ...r, workspace_id: workspaceId }));
  
  const inserted = await insertTelemetryBatch(recordsWithWorkspace);
  telemetryBus.emitSeeded(workspaceId, inserted.length);
  return inserted.length;
}

export async function startTelemetrySimulator(): Promise<SimulatorState> {
  const seededRows = await seedTelemetryDataset(false);

  return {
    enabled: true,
    running: false,
    seededRows,
    totalRows: await getTelemetryCount()
  };
}

export function stopTelemetrySimulator(): void {
}

export async function getSimulatorStatus(): Promise<SimulatorState> {
  return {
    enabled: false,
    running: false,
    seededRows: 0,
    totalRows: await getTelemetryCount()
  };
}

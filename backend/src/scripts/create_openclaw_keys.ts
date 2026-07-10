#!/usr/bin/env node
import { closeDatabase, initializeDatabase, getDatabase } from "../db/database";
import { generateWorkspaceApiKey } from "../services/authService";

interface WorkspaceRow {
  id: string;
  name: string;
  user_id: string;
}

async function main(): Promise<void> {
  await initializeDatabase();
  const db = getDatabase();
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  const label = process.env.API_KEY_LABEL?.trim() || "OpenClaw service key";
  const rows = workspaceId
    ? await db.prepare("SELECT id, name, user_id FROM workspaces WHERE id = ?").all<WorkspaceRow>(workspaceId)
    : await db.prepare("SELECT id, name, user_id FROM workspaces ORDER BY created_at ASC").all<WorkspaceRow>();

  if (rows.length === 0) {
    process.stdout.write("No workspaces found. No OpenClaw keys created.\n");
    return;
  }

  for (const workspace of rows) {
    const existing = await db.prepare(
      "SELECT id FROM api_keys WHERE workspace_id = ? AND type = 'OPENCLAW' AND revoked_at IS NULL LIMIT 1"
    ).get<{ id: string }>(workspace.id);
    if (existing && process.env.FORCE_CREATE !== "true") {
      process.stdout.write(JSON.stringify({
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        skipped: true,
        reason: "active OPENCLAW key already exists"
      }) + "\n");
      continue;
    }

    const apiKey = await generateWorkspaceApiKey({
      workspaceId: workspace.id,
      createdBy: workspace.user_id,
      label,
      type: "OPENCLAW"
    });
    process.stdout.write(JSON.stringify({
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      type: "OPENCLAW",
      api_key: apiKey
    }) + "\n");
  }
}

void main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });

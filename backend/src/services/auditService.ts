import { getDatabase } from "../db/database";

export async function logAuditEvent(input: {
  workspaceId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDatabase();
  await db.prepare(
    "INSERT INTO audit_events (workspace_id, actor_user_id, event_type, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    input.workspaceId ?? null,
    input.actorUserId ?? null,
    input.eventType,
    input.targetType,
    input.targetId ?? null,
    JSON.stringify(input.metadata ?? {}),
    Date.now()
  );
}

import { getConfig } from "../config/env";
import { getDatabase } from "../db/database";
import { generateWorkspaceApiKey, listWorkspaceApiKeys, revokeWorkspaceApiKey } from "./authService";
import { logAuditEvent } from "./auditService";
import { generateId, hashApiKey } from "../utils/auth";
import { decryptSecret, encryptSecret, generateWebhookSecret, safeSecretEquals } from "../utils/secrets";

export interface TelegramIntegration {
  id: string;
  workspace_id: string;
  telegram_bot_id: string;
  telegram_bot_username: string;
  webhook_url: string | null;
  webhook_status: string;
  enabled: boolean;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  last_connected_at: number | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  api_key_status: "active" | "revoked" | "unknown";
}

interface TelegramBotIdentity {
  id: string;
  username: string;
  first_name?: string;
}

interface IntegrationRow extends Omit<TelegramIntegration, "metadata" | "api_key_status"> {
  encrypted_bot_token: string;
  encrypted_openclaw_api_key: string;
  openclaw_api_key_id: string | null;
  webhook_secret: string;
  metadata: string | Record<string, unknown> | null;
  api_key_revoked_at?: number | null;
}

const TELEGRAM_TIMEOUT_MS = 8000;

export async function verifyTelegramBotToken(botToken: string): Promise<TelegramBotIdentity> {
  const token = normalizeBotToken(botToken);
  if (!token) {
    throw new Error("Telegram bot token is required");
  }
  const response = await fetch(`${getConfig().telegramApiUrl}/bot${token}/getMe`, {
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; result?: any; description?: string } | null;
  if (!response.ok || !body?.ok || !body.result?.id || !body.result?.username) {
    throw new Error(body?.description || "Telegram bot verification failed");
  }
  return {
    id: String(body.result.id),
    username: String(body.result.username),
    first_name: typeof body.result.first_name === "string" ? body.result.first_name : undefined
  };
}

export async function getTelegramIntegrationStatus(workspaceId: string): Promise<TelegramIntegration | null> {
  const row = await getIntegrationRowByWorkspace(workspaceId);
  return row ? normalizeIntegration(row) : null;
}

export async function connectTelegramIntegration(input: {
  workspaceId: string;
  userId: string;
  botToken: string;
  webhookBaseUrl?: string | null;
}): Promise<TelegramIntegration> {
  const db = getDatabase();
  const token = normalizeBotToken(input.botToken);
  if (!token) {
    throw new Error("Telegram bot token is required");
  }
  const bot = await verifyTelegramBotToken(token);
  const existingForBot = await getIntegrationRowByBotId(bot.id);
  if (existingForBot && existingForBot.workspace_id !== input.workspaceId) {
    throw new Error("This Telegram bot is already connected to another workspace");
  }

  return db.transaction(async () => {
    const now = Date.now();
    const existing = await getIntegrationRowByWorkspace(input.workspaceId);
    if (existing?.openclaw_api_key_id) {
      await revokeWorkspaceApiKey(input.workspaceId, existing.openclaw_api_key_id);
    }

    const openclawApiKey = await generateWorkspaceApiKey({
      workspaceId: input.workspaceId,
      createdBy: input.userId,
      label: "Telegram OpenClaw integration",
      type: "OPENCLAW"
    });
    const openclawApiKeyHash = hashApiKey(openclawApiKey);
    const keyMeta = (await listWorkspaceApiKeys(input.workspaceId)).find((key) => key.type === "OPENCLAW" && key.revoked_at === null);
    const id = existing?.id ?? generateId("tg");
    const webhookSecret = generateWebhookSecret();
    const webhookUrl = buildWebhookUrl(id, input.webhookBaseUrl);
    const encryptedBotToken = encryptSecret(token);
    const encryptedOpenClawApiKey = encryptSecret(openclawApiKey);
    const metadata = {
      bot_first_name: bot.first_name ?? null,
      openclaw_api_key_hash: openclawApiKeyHash
    };

    if (existing) {
      await db.prepare(
        `UPDATE telegram_integrations
         SET telegram_bot_id = ?, telegram_bot_username = ?, encrypted_bot_token = ?, encrypted_openclaw_api_key = ?,
             openclaw_api_key_id = ?, webhook_secret = ?, webhook_url = ?, webhook_status = ?, enabled = true,
             updated_at = ?, last_connected_at = ?, last_error = NULL, metadata = ?
         WHERE id = ? AND workspace_id = ?`
      ).run(bot.id, bot.username, encryptedBotToken, encryptedOpenClawApiKey, keyMeta?.id ?? null, webhookSecret, webhookUrl, "pending", now, now, JSON.stringify(metadata), id, input.workspaceId);
    } else {
      await db.prepare(
        `INSERT INTO telegram_integrations
          (id, workspace_id, telegram_bot_id, telegram_bot_username, encrypted_bot_token, encrypted_openclaw_api_key,
           openclaw_api_key_id, webhook_secret, webhook_url, webhook_status, enabled, created_by, created_at, updated_at,
           last_connected_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?, ?, ?, ?)`
      ).run(id, input.workspaceId, bot.id, bot.username, encryptedBotToken, encryptedOpenClawApiKey, keyMeta?.id ?? null, webhookSecret, webhookUrl, "pending", input.userId, now, now, now, JSON.stringify(metadata));
    }

    await logAuditEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      eventType: existing ? "telegram.integration.reconnected" : "telegram.integration.connected",
      targetType: "telegram_integration",
      targetId: id,
      metadata: { telegram_bot_id: bot.id, telegram_bot_username: bot.username }
    });

    if (webhookUrl) {
      await registerTelegramWebhook(id, token, webhookUrl, webhookSecret);
    }
    return (await getTelegramIntegrationStatus(input.workspaceId))!;
  });
}

export async function testTelegramIntegration(workspaceId: string, userId: string): Promise<{ ok: true; bot: { id: string; username: string }; webhookStatus: string }> {
  const row = await requireIntegration(workspaceId);
  const bot = await verifyTelegramBotToken(decryptSecret(row.encrypted_bot_token));
  await updateIntegrationStatus(row.id, "connected", null);
  await logAuditEvent({ workspaceId, actorUserId: userId, eventType: "telegram.integration.tested", targetType: "telegram_integration", targetId: row.id });
  return { ok: true, bot, webhookStatus: "connected" };
}

export async function regenerateTelegramOpenClawKey(workspaceId: string, userId: string): Promise<TelegramIntegration> {
  const db = getDatabase();
  return db.transaction(async () => {
    const row = await requireIntegration(workspaceId);
    if (row.openclaw_api_key_id) {
      await revokeWorkspaceApiKey(workspaceId, row.openclaw_api_key_id);
    }
    const openclawApiKey = await generateWorkspaceApiKey({
      workspaceId,
      createdBy: userId,
      label: "Telegram OpenClaw integration",
      type: "OPENCLAW"
    });
    const keyMeta = (await listWorkspaceApiKeys(workspaceId)).find((key) => key.type === "OPENCLAW" && key.revoked_at === null);
    await db.prepare("UPDATE telegram_integrations SET encrypted_openclaw_api_key = ?, openclaw_api_key_id = ?, updated_at = ? WHERE id = ?")
      .run(encryptSecret(openclawApiKey), keyMeta?.id ?? null, Date.now(), row.id);
    await logAuditEvent({ workspaceId, actorUserId: userId, eventType: "telegram.integration.openclaw_key_regenerated", targetType: "telegram_integration", targetId: row.id });
    return (await getTelegramIntegrationStatus(workspaceId))!;
  });
}

export async function deleteTelegramIntegration(workspaceId: string, userId: string): Promise<boolean> {
  const db = getDatabase();
  return db.transaction(async () => {
    const row = await getIntegrationRowByWorkspace(workspaceId);
    if (!row) {
      return false;
    }
    if (row.openclaw_api_key_id) {
      await revokeWorkspaceApiKey(workspaceId, row.openclaw_api_key_id);
    }
    await db.prepare("DELETE FROM telegram_integrations WHERE workspace_id = ?").run(workspaceId);
    await logAuditEvent({ workspaceId, actorUserId: userId, eventType: "telegram.integration.disconnected", targetType: "telegram_integration", targetId: row.id });
    return true;
  });
}

export async function resolveTelegramWebhook(input: {
  integrationId: string;
  telegramSecret: string | null | undefined;
}): Promise<{
  integrationId: string;
  workspaceId: string;
  botToken: string;
  openclawApiKey: string;
  telegramBotUsername: string;
}> {
  const row = await getIntegrationRowById(input.integrationId);
  if (!row || !row.enabled) {
    throw new Error("Telegram integration not found");
  }
  if (!safeSecretEquals(row.webhook_secret, input.telegramSecret)) {
    throw new Error("Invalid Telegram webhook secret");
  }
  await updateIntegrationSeen(row.id);
  return {
    integrationId: row.id,
    workspaceId: row.workspace_id,
    botToken: decryptSecret(row.encrypted_bot_token),
    openclawApiKey: decryptSecret(row.encrypted_openclaw_api_key),
    telegramBotUsername: row.telegram_bot_username
  };
}

async function registerTelegramWebhook(integrationId: string, botToken: string, webhookUrl: string, webhookSecret: string): Promise<void> {
  const response = await fetch(`${getConfig().telegramApiUrl}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message"]
    }),
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !body?.ok) {
    const message = body?.description || "Telegram webhook registration failed";
    await updateIntegrationStatus(integrationId, "error", message);
    throw new Error(message);
  }
  await updateIntegrationStatus(integrationId, "connected", null);
}

function buildWebhookUrl(integrationId: string, override?: string | null): string | null {
  const base = override?.trim().replace(/\/+$/u, "") || getConfig().openClawPublicUrl;
  return base ? `${base}/telegram/webhook/${encodeURIComponent(integrationId)}` : null;
}

function normalizeBotToken(value: unknown): string {
  const token = typeof value === "string" ? value.trim() : "";
  return /^\d+:[A-Za-z0-9_-]{20,}$/u.test(token) ? token : "";
}

async function getIntegrationRowByWorkspace(workspaceId: string): Promise<IntegrationRow | null> {
  const row = await getDatabase().prepare(
    `SELECT telegram_integrations.*, api_keys.revoked_at AS api_key_revoked_at
     FROM telegram_integrations
     LEFT JOIN api_keys ON telegram_integrations.openclaw_api_key_id = api_keys.id
     WHERE telegram_integrations.workspace_id = ?`
  ).get<IntegrationRow>(workspaceId);
  return row ?? null;
}

async function getIntegrationRowById(id: string): Promise<IntegrationRow | null> {
  const row = await getDatabase().prepare("SELECT * FROM telegram_integrations WHERE id = ?").get<IntegrationRow>(id);
  return row ?? null;
}

async function getIntegrationRowByBotId(botId: string): Promise<IntegrationRow | null> {
  const row = await getDatabase().prepare("SELECT * FROM telegram_integrations WHERE telegram_bot_id = ?").get<IntegrationRow>(botId);
  return row ?? null;
}

async function requireIntegration(workspaceId: string): Promise<IntegrationRow> {
  const row = await getIntegrationRowByWorkspace(workspaceId);
  if (!row) {
    throw new Error("Telegram integration is not connected");
  }
  return row;
}

async function updateIntegrationStatus(id: string, status: string, lastError: string | null): Promise<void> {
  await getDatabase().prepare("UPDATE telegram_integrations SET webhook_status = ?, last_error = ?, updated_at = ? WHERE id = ?")
    .run(status, lastError, Date.now(), id);
}

async function updateIntegrationSeen(id: string): Promise<void> {
  await getDatabase().prepare("UPDATE telegram_integrations SET last_connected_at = ?, updated_at = ?, webhook_status = 'connected', last_error = NULL WHERE id = ?")
    .run(Date.now(), Date.now(), id);
}

function normalizeIntegration(row: IntegrationRow): TelegramIntegration {
  const metadata = typeof row.metadata === "string"
    ? JSON.parse(row.metadata || "{}")
    : row.metadata ?? {};
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    telegram_bot_id: row.telegram_bot_id,
    telegram_bot_username: row.telegram_bot_username,
    webhook_url: row.webhook_url ?? null,
    webhook_status: row.webhook_status,
    enabled: Boolean(row.enabled),
    created_by: row.created_by ?? null,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    last_connected_at: row.last_connected_at === null || row.last_connected_at === undefined ? null : Number(row.last_connected_at),
    last_error: row.last_error ?? null,
    metadata,
    api_key_status: row.openclaw_api_key_id ? row.api_key_revoked_at ? "revoked" : "active" : "unknown"
  };
}

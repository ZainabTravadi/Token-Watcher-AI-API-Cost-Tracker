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

interface TelegramSendMessageResponse {
  ok?: boolean;
  result?: {
    message_id?: number;
    chat?: {
      id?: number;
    };
  };
  description?: string;
}

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
  const config = getConfig();
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
    const id = existing?.id ?? generateId("tg");
    const candidateWebhookUrl = buildWebhookUrl(id, input.webhookBaseUrl, config.openClawPublicUrl);
    const webhookUrl = candidateWebhookUrl ?? existing?.webhook_url ?? null;

    console.info("[telegram:connect:start]", {
      workspaceId: input.workspaceId,
      userId: input.userId,
      botId: bot.id,
      botUsername: bot.username,
      integrationId: id,
      openClawPublicUrl: config.openClawPublicUrl,
      webhookBaseUrl: input.webhookBaseUrl ?? null,
      candidateWebhookUrl,
      webhookUrl,
      reusedExistingWebhookUrl: !candidateWebhookUrl && Boolean(existing?.webhook_url)
    });

    if (!webhookUrl) {
      throw new Error("Telegram webhook registration requires OPENCLAW_PUBLIC_URL or an existing saved webhook URL.");
    }

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
    const webhookSecret = generateWebhookSecret();
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

    await registerTelegramWebhook(id, token, webhookUrl, webhookSecret, config.telegramApiUrl);
    return (await getTelegramIntegrationStatus(input.workspaceId))!;
  });
}

export async function testTelegramIntegration(workspaceId: string, userId: string): Promise<{ ok: true; bot: { id: string; username: string }; webhookStatus: string; chatId: number; messageId: number | null }> {
  const row = await requireIntegration(workspaceId);
  const botToken = decryptSecret(row.encrypted_bot_token);
  const bot = await verifyTelegramBotToken(botToken);
  const chatId = getLastTelegramChatId(row);
  const telegramUserId = getLastTelegramUserId(row);

  console.info("[telegram:test:lookup]", {
    workspaceId,
    userId,
    integrationId: row.id,
    chatId,
    telegramUserId,
    metadataSaved: Boolean(chatId !== null)
  });

  if (chatId === null) {
    console.warn("[telegram:test:missing-chat]", { workspaceId, integrationId: row.id, bot: `@${row.telegram_bot_username}` });
    throw new Error("No Telegram chat has been seen yet. Send the bot a message first, then test again.");
  }

  const testMessage = buildTelegramTestMessage(workspaceId, row.telegram_bot_username);
  const delivery = await sendTelegramMessage({
    botToken,
    chatId,
    text: testMessage,
    workspaceId,
    integrationId: row.id,
    botUsername: row.telegram_bot_username
  });

  await updateIntegrationStatus(row.id, "connected", null);
  await logAuditEvent({
    workspaceId,
    actorUserId: userId,
    eventType: "telegram.integration.tested",
    targetType: "telegram_integration",
    targetId: row.id,
    metadata: { telegram_bot_id: bot.id, telegram_bot_username: bot.username, chat_id: chatId, message_id: delivery.messageId }
  });

  return { ok: true, bot, webhookStatus: "connected", chatId, messageId: delivery.messageId };
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
  chatId?: number | null;
  telegramUserId?: number | null;
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
  await updateIntegrationSeen(row, input.chatId ?? null, input.telegramUserId ?? null);
  return {
    integrationId: row.id,
    workspaceId: row.workspace_id,
    botToken: decryptSecret(row.encrypted_bot_token),
    openclawApiKey: decryptSecret(row.encrypted_openclaw_api_key),
    telegramBotUsername: row.telegram_bot_username
  };
}

async function registerTelegramWebhook(
  integrationId: string,
  botToken: string,
  webhookUrl: string,
  webhookSecret: string,
  telegramApiUrl: string
): Promise<void> {
  const requestBody = {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ["message"]
  };

  console.info("[telegram:webhook:set:entered]", {
    integrationId,
    webhookUrl
  });
  console.info("[telegram:webhook:set:start]", {
    integrationId,
    webhookUrl,
    telegramApiUrl,
    allowedUpdates: requestBody.allowed_updates
  });

  const requestUrl = `${telegramApiUrl}/bot${botToken}/setWebhook`;
  console.info("[telegram:webhook:set:request]", {
    integrationId,
    requestUrl,
    requestBody
  });

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
    });
    const responseText = await response.text();
    console.info("[telegram:webhook:set:response]", {
      integrationId,
      webhookUrl,
      status: response.status,
      responseText
    });

    let body: { ok?: boolean; description?: string } | null = null;
    try {
      body = responseText ? JSON.parse(responseText) as { ok?: boolean; description?: string } : null;
    } catch (parseError) {
      console.error("[telegram:webhook:set:response-parse-error]", {
        integrationId,
        webhookUrl,
        status: response.status,
        responseText,
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
    }

    if (!response.ok || !body?.ok) {
      const message = body?.description || `Telegram webhook registration failed with ${response.status}`;
      await updateIntegrationStatus(integrationId, "error", message);
      throw new Error(message);
    }
    await updateIntegrationStatus(integrationId, "connected", null);
  } catch (error) {
    console.error("[telegram:webhook:set:exception]", {
      integrationId,
      webhookUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

function buildWebhookUrl(integrationId: string, override?: string | null, openClawPublicUrl?: string | null): string | null {
  const base = override?.trim().replace(/\/+$/u, "") || openClawPublicUrl || getConfig().openClawPublicUrl;
  const webhookUrl = base ? `${base}/telegram/webhook/${encodeURIComponent(integrationId)}` : null;
  console.info("[telegram:webhook:url:resolved]", {
    integrationId,
    override: override ?? null,
    openClawPublicUrl: openClawPublicUrl ?? getConfig().openClawPublicUrl,
    webhookUrl
  });
  return webhookUrl;
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

async function updateIntegrationSeen(row: IntegrationRow, chatId: number | null, telegramUserId: number | null): Promise<void> {
  const metadata = normalizeMetadata(row.metadata);
  if (typeof chatId === "number" && Number.isFinite(chatId)) {
    metadata.last_chat_id = Math.trunc(chatId);
    metadata.last_chat_seen_at = Date.now();
  }
  if (typeof telegramUserId === "number" && Number.isFinite(telegramUserId)) {
    metadata.last_telegram_user_id = Math.trunc(telegramUserId);
    metadata.last_telegram_user_seen_at = Date.now();
  }

  console.info("[telegram:webhook:save:start]", {
    workspaceId: row.workspace_id,
    integrationId: row.id,
    chatId,
    telegramUserId,
    willSave: typeof chatId === "number" && Number.isFinite(chatId)
  });

  await getDatabase().prepare(
    "UPDATE telegram_integrations SET last_connected_at = ?, updated_at = ?, webhook_status = 'connected', last_error = NULL, metadata = ? WHERE id = ?"
  ).run(Date.now(), Date.now(), JSON.stringify(metadata), row.id);

  console.info("[telegram:webhook:save:ok]", {
    workspaceId: row.workspace_id,
    integrationId: row.id,
    chatId: normalizeChatId(metadata.last_chat_id),
    telegramUserId: normalizeChatId(metadata.last_telegram_user_id),
    saved: typeof chatId === "number" && Number.isFinite(chatId)
  });
}

function normalizeIntegration(row: IntegrationRow): TelegramIntegration {
  const metadata = normalizeMetadata(row.metadata);
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

function normalizeMetadata(metadata: string | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return metadata ?? {};
}

function getLastTelegramChatId(row: IntegrationRow): number | null {
  const metadata = normalizeMetadata(row.metadata);
  return normalizeChatId(metadata.last_chat_id);
}

function getLastTelegramUserId(row: IntegrationRow): number | null {
  const metadata = normalizeMetadata(row.metadata);
  return normalizeChatId(metadata.last_telegram_user_id);
}

function normalizeChatId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

function buildTelegramTestMessage(workspaceId: string, botUsername: string): string {
  return [
    "TokenWatch Telegram test message",
    `Workspace: ${workspaceId}`,
    `Bot: @${botUsername}`,
    `Timestamp: ${new Date().toISOString()}`
  ].join("\n");
}

async function sendTelegramMessage(input: {
  botToken: string;
  chatId: number;
  text: string;
  workspaceId: string;
  integrationId: string;
  botUsername: string;
}): Promise<{ messageId: number | null }> {
  console.info("[telegram:test:send:start]", {
    workspaceId: input.workspaceId,
    integrationId: input.integrationId,
    chatId: input.chatId,
    bot: `@${input.botUsername}`
  });

  const response = await fetch(`${getConfig().telegramApiUrl}/bot${input.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text
    }),
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
  });

  const body = await response.json().catch(() => null) as TelegramSendMessageResponse | null;
  if (!response.ok || !body?.ok || !body.result?.message_id) {
    const description = body?.description || `Telegram sendMessage failed with ${response.status}`;
    console.error("[telegram:test:send:error]", {
      workspaceId: input.workspaceId,
      integrationId: input.integrationId,
      chatId: input.chatId,
      status: response.status,
      description
    });
    throw new Error(description);
  }

  console.info("[telegram:test:send:ok]", {
    workspaceId: input.workspaceId,
    integrationId: input.integrationId,
    chatId: input.chatId,
    messageId: body.result.message_id
  });

  return { messageId: body.result.message_id ?? null };
}

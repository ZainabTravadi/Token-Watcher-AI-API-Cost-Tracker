import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { OpenClawConfig } from "./config/env";
import { formatUserFacingError } from "./errors";
import type { Logger } from "./logger";
import { routeIntent } from "./router/intentRouter";
import { renderTelegramResponse } from "./telegram/render";
import type { TelegramUpdate } from "./telegram/types";
import { TelegramTransport } from "./telegram/transport";
import { TokenWatcherClient } from "./tokenwatcher/client";
import { TokenWatcherToolRegistry } from "./tokenwatcher/tools";

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_WEBHOOK_BODY_BYTES) {
      throw new Error("Webhook payload too large");
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function notFound(response: ServerResponse): void {
  writeJson(response, 404, { error: "Not found" });
}

export function createOpenClawServer(
  config: OpenClawConfig,
  logger: Logger,
  tokenWatcher: TokenWatcherClient,
  telegram: TelegramTransport
): http.Server {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || `${config.host}:${config.port}`}`);

      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, {
          status: "ok",
          service: "openclaw",
          phase: "3B",
          timestamp: new Date().toISOString()
        });
        return;
      }

      const webhookMatch = url.pathname.match(/^\/telegram\/webhook(?:\/([^/]+))?$/u);
      if (request.method === "POST" && webhookMatch) {
        const integrationId = webhookMatch[1] ? decodeURIComponent(webhookMatch[1]) : null;
        const receivedSecret = request.headers["x-telegram-bot-api-secret-token"];
        if (typeof receivedSecret !== "string") {
          logger.warn("telegram.webhook.rejected", { integrationId, reason: "missing_secret" });
          writeJson(response, 403, { error: "Forbidden" });
          return;
        }

        if (!integrationId) {
          logger.warn("telegram.webhook.rejected", { reason: "missing_integration_id" });
          writeJson(response, 400, { error: "Integration ID required" });
          return;
        }

        let update: TelegramUpdate;
        try {
          update = await readJsonBody(request) as TelegramUpdate;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid JSON";
          logger.warn("telegram.webhook.rejected", { reason: message });
          writeJson(response, message.includes("too large") ? 413 : 400, { error: message.includes("too large") ? "Payload too large" : "Invalid JSON" });
          return;
        }
        const message = update.message?.text?.trim();
        const chatId = update.message?.chat?.id;
        const telegramUserId = update.message?.from?.id ?? null;

        logger.info("telegram.webhook.message", {
          integrationId,
          chatId: typeof chatId === "number" ? chatId : null,
          telegramUserId,
          updateId: update.update_id,
          message
        });

        if (!message || typeof chatId !== "number") {
          logger.info("telegram.webhook.ignored", {
            integrationId,
            chatId: typeof chatId === "number" ? chatId : null,
            telegramUserId,
            reason: "missing_message_or_chat"
          });
          writeJson(response, 200, { ok: true, ignored: true });
          return;
        }

        logger.info("telegram.webhook.received", {
          integrationId,
          chatId,
          telegramUserId,
          updateId: update.update_id,
          message
        });

        let resolved: Awaited<ReturnType<TokenWatcherClient["resolveTelegramWebhook"]>>;
        try {
          resolved = await tokenWatcher.resolveTelegramWebhook({
            integrationId,
            telegramSecret: receivedSecret,
            chatId,
            telegramUserId
          });
        } catch (error) {
          logger.warn("telegram.webhook.rejected", {
            integrationId,
            reason: error instanceof Error ? error.message : String(error)
          });
          writeJson(response, 403, { error: "Forbidden" });
          return;
        }
        const scopedClient = tokenWatcher.withApiKey(resolved.context.openclawApiKey);
        const tools = new TokenWatcherToolRegistry(scopedClient, logger);

        try {
          const invocation = routeIntent(message);
          logger.info("telegram.intent.selected", {
            integrationId,
            chatId,
            telegramUserId,
            updateId: update.update_id,
            message,
            intent: invocation.name
          });

          if (invocation.name === "copilot.chat") {
            logger.warn("telegram.intent.generic_chat_fallback", {
              integrationId,
              chatId,
              telegramUserId,
              updateId: update.update_id,
              message,
              intent: invocation.name
            });
          }

          const result = await tools.execute(invocation);
          const reply = renderTelegramResponse(result);
          logger.info("telegram.reply.sending", {
            integrationId,
            chatId,
            telegramUserId,
            tool: invocation.name
          });
          await telegram.sendMessage(resolved.context.botToken, chatId, reply);
          logger.info("telegram.reply.sent", {
            integrationId,
            chatId,
            telegramUserId,
            tool: invocation.name
          });

          writeJson(response, 200, {
            ok: true,
            tool: invocation.name,
            route: result.route
          });
          return;
        } catch (error) {
          logger.error("telegram.webhook.failed", {
            chatId,
            telegramUserId,
            updateId: update.update_id,
            error: error instanceof Error ? error.message : String(error)
          });
          try {
            logger.info("telegram.error_reply.sending", {
              integrationId,
              chatId,
              telegramUserId,
              updateId: update.update_id
            });
            await telegram.sendMessage(resolved.context.botToken, chatId, formatUserFacingError(error));
            logger.info("telegram.error_reply.sent", {
              integrationId,
              chatId,
              telegramUserId,
              updateId: update.update_id
            });
          } catch (sendError) {
            logger.error("telegram.error_reply.failed", {
              chatId,
              telegramUserId,
              updateId: update.update_id,
              error: sendError instanceof Error ? sendError.message : String(sendError)
            });
          }
          writeJson(response, 200, { ok: true, handledError: true });
          return;
        }
      }

      notFound(response);
    } catch (error) {
      logger.error("server.request.failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      writeJson(response, 500, { error: "Internal server error" });
    }
  });
}

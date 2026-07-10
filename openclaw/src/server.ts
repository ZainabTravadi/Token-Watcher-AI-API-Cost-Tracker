import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { OpenClawConfig } from "./config/env";
import { formatUserFacingError } from "./errors";
import type { Logger } from "./logger";
import { routeIntent } from "./router/intentRouter";
import { renderTelegramResponse } from "./telegram/render";
import type { TelegramUpdate } from "./telegram/types";
import { TelegramTransport } from "./telegram/transport";
import { TokenWatcherToolRegistry } from "./tokenwatcher/tools";

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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
  tools: TokenWatcherToolRegistry,
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

      if (request.method === "POST" && url.pathname === "/telegram/webhook") {
        const expectedSecret = config.telegramSecretToken;
        const receivedSecret = request.headers["x-telegram-bot-api-secret-token"];
        if (expectedSecret && receivedSecret !== expectedSecret) {
          logger.warn("telegram.webhook.rejected", { reason: "invalid_secret" });
          writeJson(response, 403, { error: "Forbidden" });
          return;
        }

        const update = await readJsonBody(request) as TelegramUpdate;
        const message = update.message?.text?.trim();
        const chatId = update.message?.chat?.id;

        if (!message || typeof chatId !== "number") {
          writeJson(response, 200, { ok: true, ignored: true });
          return;
        }

        try {
          const invocation = routeIntent(message);
          logger.info("telegram.webhook.received", {
            chatId,
            updateId: update.update_id,
            tool: invocation.name
          });

          const result = await tools.execute(invocation);
          const reply = renderTelegramResponse(result);
          await telegram.sendMessage(chatId, reply);

          writeJson(response, 200, {
            ok: true,
            tool: invocation.name,
            route: result.route
          });
          return;
        } catch (error) {
          logger.error("telegram.webhook.failed", {
            chatId,
            updateId: update.update_id,
            error: error instanceof Error ? error.message : String(error)
          });
          await telegram.sendMessage(chatId, formatUserFacingError(error));
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

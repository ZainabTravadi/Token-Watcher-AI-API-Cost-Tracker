import { getConfig } from "./config/env";
import { createLogger } from "./logger";
import { createOpenClawServer } from "./server";
import { TelegramTransport } from "./telegram/transport";
import { TokenWatcherClient } from "./tokenwatcher/client";
import { TokenWatcherToolRegistry } from "./tokenwatcher/tools";

async function bootstrap(): Promise<void> {
  const config = getConfig();
  const logger = createLogger(config.logLevel);
  const client = new TokenWatcherClient(config, logger);
  const identity = await client.getIdentity();
  const key = identity.identity?.key;
  const permissions = new Set(key?.permissions ?? []);
  const allowedTypes = new Set(["OPENCLAW", "SERVICE", "ADMIN"]);

  if (identity.identity?.type !== "api_key" || !key?.type || !allowedTypes.has(key.type)) {
    throw new Error("TOKENWATCHER_API_KEY must be an OpenClaw, service, or admin API key.");
  }

  for (const permission of ["workspace:read", "analytics:read", "requests:read", "reports:read", "recommendations:read", "forecast:read", "copilot:use"]) {
    if (!permissions.has(permission) && !permissions.has("admin:all")) {
      throw new Error(`TOKENWATCHER_API_KEY is missing required permission: ${permission}`);
    }
  }

  logger.info("tokenwatcher.identity", {
    keyType: key.type,
    keyLabel: key.label,
    workspace: identity.identity?.workspace?.id,
    organization: identity.identity?.organization?.id,
    owner: identity.identity?.owner?.id
  });

  const tools = new TokenWatcherToolRegistry(client, logger);
  const telegram = new TelegramTransport(config, logger);
  const server = createOpenClawServer(config, logger, tools, telegram);

  server.listen(config.port, config.host, () => {
    logger.info("server.started", {
      host: config.host,
      port: config.port,
      tokenWatcherApiUrl: config.tokenWatcherApiUrl,
      authMode: "api_key"
    });
  });

  const shutdown = (signal: string) => {
    logger.info("server.stopping", { signal });
    server.close(() => {
      logger.info("server.stopped", { signal });
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  const logger = createLogger(process.env.OPENCLAW_LOG_LEVEL === "debug" ? "debug" : "error");
  logger.error("server.start_failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});

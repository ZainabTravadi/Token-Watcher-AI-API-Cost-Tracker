import { getConfig } from "./config/env";
import { createLogger } from "./logger";
import { createOpenClawServer } from "./server";
import { TelegramTransport } from "./telegram/transport";
import { TokenWatcherClient } from "./tokenwatcher/client";

async function bootstrap(): Promise<void> {
  const config = getConfig();
  const logger = createLogger(config.logLevel);
  const client = new TokenWatcherClient(config, logger);
  const telegram = new TelegramTransport(config, logger);
  const server = createOpenClawServer(config, logger, client, telegram);

  server.listen(config.port, config.host, () => {
    logger.info("server.started", {
      host: config.host,
      port: config.port,
      tokenWatcherApiUrl: config.tokenWatcherApiUrl,
      authMode: "per_integration"
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

import { getConfig } from "./config/env";
import { createLogger } from "./logger";
import { createOpenClawServer } from "./server";
import { TelegramTransport } from "./telegram/transport";
import { TokenWatcherClient } from "./tokenwatcher/client";
import { TokenWatcherToolRegistry } from "./tokenwatcher/tools";

const config = getConfig();
const logger = createLogger(config.logLevel);
const client = new TokenWatcherClient(config, logger);
const tools = new TokenWatcherToolRegistry(client, logger);
const telegram = new TelegramTransport(config, logger);
const server = createOpenClawServer(config, logger, tools, telegram);

server.listen(config.port, config.host, () => {
  logger.info("server.started", {
    host: config.host,
    port: config.port,
    tokenWatcherApiUrl: config.tokenWatcherApiUrl,
    authMode: config.tokenWatcherAuthMode
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

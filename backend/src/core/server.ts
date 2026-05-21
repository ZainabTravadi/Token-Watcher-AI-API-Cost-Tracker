import { createApp } from "./app";
import { getDatabase } from "../db/database";
import { getConfig } from "../config/env";
import { buildRealtimeAnalyticsSnapshot } from "../services/analyticsService";
import { getTelemetryCount } from "../services/telemetryRepository";
import { startTelemetrySimulator } from "../services/simulatorService";
import { startSdkDemo, stopSdkDemo } from "../services/demoRunner";
import { stopAllSimulators } from "../services/workspaceSimulatorManager";

export async function startServer(): Promise<void> {
  const config = getConfig();
  const database = getDatabase();
  // Startup warnings for ops
  if (config.nodeEnv === "production" && !process.env.TELEMETRY_RETENTION_DAYS) {
    // eslint-disable-next-line no-console
    console.warn("[startup] NOTICE: TELEMETRY_RETENTION_DAYS not set. Consider configuring retention to control DB growth.");
  }
  const simulatorState = config.enableSimulators
    ? startTelemetrySimulator()
    : { running: false, enabled: false, seededRows: 0, totalRows: getTelemetryCount() };
  const firstWorkspace = database.prepare("SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1").get() as { id: string } | undefined;
  const analytics = firstWorkspace ? buildRealtimeAnalyticsSnapshot(firstWorkspace.id) : null;
  const apiUrl = `http://localhost:${config.port}`;
  const demoProcess = config.enableSimulators ? startSdkDemo(apiUrl) : null;

  const app = createApp();

  const server = app.listen(config.port, () => {
    const separator = "─".repeat(62);
    process.stdout.write(`\n${separator}\n`);
    process.stdout.write("TokenWatch backend started\n");
    process.stdout.write(`${separator}\n`);
    process.stdout.write(`Server URL           http://localhost:${config.port}\n`);
    process.stdout.write(`Database status      connected (${database.name ?? config.databasePath})\n`);
    const telemetryStatus = config.enableSimulators
      ? `Telemetry status     seeded ${simulatorState.seededRows.toLocaleString()} rows · sdk demo ${demoProcess ? "running" : "not started"}\n`
      : "Telemetry status     disabled · sdk demo disabled\n";
    process.stdout.write(telemetryStatus);
    process.stdout.write(`Ingest API           ${apiUrl}/api/ingest\n`);
    process.stdout.write(`Requests generated   ${getTelemetryCount()} rows\n`);
    if (analytics) {
      process.stdout.write(`Analytics summary    $${analytics.overview.spendToday.toFixed(2)} today · ${analytics.overview.requestsToday.toLocaleString()} requests · ${(analytics.overview.errorRate * 100).toFixed(2)}% errors\n`);
    } else {
      process.stdout.write("Analytics summary    awaiting workspace data\n");
    }
    process.stdout.write(`${separator}\n\n`);
  });

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.info("\n[server] Shutting down gracefully...");
    stopAllSimulators();
    stopSdkDemo();
    server.close(() => {
      console.info("[server] Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}
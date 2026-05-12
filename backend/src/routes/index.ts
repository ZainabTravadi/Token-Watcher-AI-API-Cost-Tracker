import type { Express } from "express";
import { createAnalyticsRouter } from "./analytics";
import { createHealthRouter } from "./health";
import { createIngestRouter } from "./ingest";
import { createRequestsRouter } from "./requests";
import { createTelemetryRouter } from "./telemetry";

export function registerRoutes(app: Express): void {
  app.use("/", createHealthRouter());
  app.use("/api", createHealthRouter());
  app.use("/api", createRequestsRouter());
  app.use("/api", createIngestRouter());
  app.use("/", createIngestRouter());
  app.use("/api", createAnalyticsRouter());
  app.use("/api", createTelemetryRouter());
}
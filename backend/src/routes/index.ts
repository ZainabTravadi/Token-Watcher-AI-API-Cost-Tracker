import type { Express } from "express";
import { createAuthRouter } from "./auth";
import { createWorkspacesRouter } from "./workspaces";
import { createAnalyticsRouter } from "./analytics";
import { createHealthRouter } from "./health";
import { createIngestRouter } from "./ingest";
import { createRequestsRouter } from "./requests";
import { createTelemetryRouter } from "./telemetry";
import { createAiRouter } from "./ai";

export function registerRoutes(app: Express): void {
  app.use("/", createHealthRouter());
  app.use("/api", createHealthRouter());
  
  // Auth routes
  app.use("/api/auth", createAuthRouter());
  
  // Workspace routes (protected)
  app.use("/api/workspaces", createWorkspacesRouter());
  
  // Existing routes
  app.use("/api", createRequestsRouter());
  app.use("/api", createIngestRouter());
  app.use("/", createIngestRouter());
  app.use("/api", createAnalyticsRouter());
  app.use("/api", createTelemetryRouter());
  // AI insights
  app.use("/api", createAiRouter());
}
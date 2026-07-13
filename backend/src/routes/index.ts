import type { Express } from "express";
import { createAuthRouter } from "./auth";
import { createWorkspacesRouter } from "./workspaces";
import { createAnalyticsRouter } from "./analytics";
import { createHealthRouter } from "./health";
import { createIngestRouter } from "./ingest";
import { createRequestsRouter } from "./requests";
import { createTelemetryRouter } from "./telemetry";
import { createAiRouter } from "./ai";
import { createIntelligenceRouter } from "./intelligence";
import { createReportsRouter } from "./reports";
import { createForecastRouter } from "./forecast";
import { createCopilotRouter } from "./copilot";
import { createMeRouter } from "./me";
import { createTelegramIntegrationsRouter } from "./telegramIntegrations";

export function registerRoutes(app: Express): void {
  app.use("/", createHealthRouter());
  app.use("/api", createHealthRouter());
  
  // Auth routes
  app.use("/api/auth", createAuthRouter());
  app.use("/api", createMeRouter());
  
  // Workspace routes (protected)
  app.use("/api/workspaces", createWorkspacesRouter());
  app.use("/api/integrations", createTelegramIntegrationsRouter());
  
  // Existing routes
  app.use("/api", createRequestsRouter());
  app.use("/api", createIngestRouter());
  app.use("/", createIngestRouter());
  app.use("/api", createAnalyticsRouter());
  app.use("/api", createTelemetryRouter());
  // AI insights
  app.use("/api", createAiRouter());
  app.use("/api", createIntelligenceRouter());
  app.use("/api", createReportsRouter());
  app.use("/api", createForecastRouter());
  app.use("/api", createCopilotRouter());
}

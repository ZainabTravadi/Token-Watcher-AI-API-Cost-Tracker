import { Router } from "express";
import { listLatestTelemetry, listForExport, type ExportTelemetryQuery } from "../services/telemetryRepository";
import { getSimulatorStatus } from "../services/simulatorService";
import { authenticateUser, requireOwnedWorkspace, type AuthenticatedRequest } from "../middleware/auth";
import { getWorkspaceSimulatorStatus } from "../services/workspaceSimulatorManager";
import { setupWorkspaceSse } from "../services/realtimeStreamService";
import { generateTelemetryPdf } from "../services/telemetryPdfService";

interface ExportRow {
  timestamp: number;
  workspace_id: string;
  provider: string;
  model: string;
  endpoint: string;
  status: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

export function createTelemetryRouter(): Router {
  const router = Router();

  router.get(
    "/telemetry",
    authenticateUser,
    requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      const limit = Number.parseInt(String(request.query.limit ?? "100"), 10);
      response.json({
        data: await listLatestTelemetry(
          request.workspaceId,
          Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100
        ),
        simulator: await getSimulatorStatus()
      });
    }
  );

  router.get(
    "/telemetry/export-pdf",
    authenticateUser,
    requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      try {
        if (!request.workspaceId) {
          response.status(400).json({ error: "Workspace ID required" });
          return;
        }

        // Parse query parameters
        const from = String(request.query.from ?? "");
        const to = String(request.query.to ?? "");
        const providers = Array.isArray(request.query.provider) 
          ? (request.query.provider as string[]) 
          : (request.query.provider ? [request.query.provider as string] : []);
        const models = Array.isArray(request.query.model) 
          ? (request.query.model as string[]) 
          : (request.query.model ? [request.query.model as string] : []);
        const endpoints = Array.isArray(request.query.endpoint) 
          ? (request.query.endpoint as string[]) 
          : (request.query.endpoint ? [request.query.endpoint as string] : []);
        const statuses = Array.isArray(request.query.status) 
          ? (request.query.status as string[]) 
          : (request.query.status ? [request.query.status as string] : []);

        if (!from || !to) {
          response.status(400).json({ error: "Date range (from, to) required" });
          return;
        }

        // Query telemetry with filters
        const query: ExportTelemetryQuery = {
          from,
          to,
          providers: providers.filter(Boolean),
          models: models.filter(Boolean),
          endpoints: endpoints.filter(Boolean),
          statuses: statuses.filter(Boolean),
          limit: 100000
        };

        const rows = await listForExport(request.workspaceId, query);
        if (rows.length === 0) {
          response.status(400).json({ error: "No telemetry records found for the specified filters" });
          return;
        }

        // Convert to export format expected by PDF generator
        const exportRows = rows.map(row => ({
          timestamp: row.timestamp,
          workspace_id: row.workspace_id,
          provider: row.provider,
          model: row.model,
          endpoint: row.route,
          status: !row.error ? "200" : row.error.toLowerCase().includes("429") ? "429" : row.error.toLowerCase().includes("500") ? "500" : "ERR",
          requests: 1,
          input_tokens: row.input_tokens,
          output_tokens: row.output_tokens,
          total_tokens: row.total_tokens,
          cost_usd: row.cost_usd,
          latency_ms: row.latency_ms,
        }));

        const pdfBuffer = generateTelemetryPdf(exportRows);
        const timestamp = new Date().toISOString().slice(0, 10);
        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Disposition", `attachment; filename="overview-${timestamp}.pdf"`);
        response.send(pdfBuffer);
      } catch (error) {
        console.error("Telemetry PDF export error:", error);
        response.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  );

  router.get("/telemetry/status", async (_request, response) => {
    response.json({ data: await getSimulatorStatus() });
  });

  router.get(
    "/telemetry/workspace-simulator-status",
    authenticateUser,
    requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      const status = getWorkspaceSimulatorStatus(request.workspaceId);
      response.json({ data: status || { running: false, recordsGenerated: 0, uptime: 0 } });
    }
  );

  router.get(
    "/telemetry/stream",
    authenticateUser,
    requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      setupWorkspaceSse(request, response, request.workspaceId!);
    }
  );

  return router;
}

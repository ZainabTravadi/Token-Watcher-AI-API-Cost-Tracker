import type { Request, Response } from "express";
import { Router } from "express";
import { telemetryBus } from "../services/telemetryBus";
import { listLatestTelemetry } from "../services/telemetryRepository";
import { getSimulatorStatus } from "../services/simulatorService";
import { authenticateUser, attachWorkspaceOptional, type AuthenticatedRequest } from "../middleware/auth";
import { getWorkspaceSimulatorStatus } from "../services/workspaceSimulatorManager";

export function createTelemetryRouter(): Router {
  const router = Router();

  router.get(
    "/telemetry",
    authenticateUser,
    attachWorkspaceOptional,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      const limit = Number.parseInt(String(request.query.limit ?? "100"), 10);
      response.json({
        data: listLatestTelemetry(
          request.workspaceId,
          Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100
        ),
        simulator: getSimulatorStatus()
      });
    }
  );

  router.get("/telemetry/status", (_request, response) => {
    response.json({ data: getSimulatorStatus() });
  });

  // Get workspace-specific simulator status
  router.get(
    "/telemetry/workspace-simulator-status",
    authenticateUser,
    attachWorkspaceOptional,
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
    attachWorkspaceOptional,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      setupSse(request, response, request.workspaceId);
    }
  );

  return router;
}

function setupSse(request: Request, response: Response, workspaceId: string): void {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  const send = (event: string, payload: unknown): void => {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Filter telemetry events by workspace
  const telemetryHandler = (record: any): void => {
    if (record.workspace_id === workspaceId) {
      send("telemetry", record);
    }
  };
  const seededHandler = (count: number): void => send("seeded", { count });

  telemetryBus.on("telemetry", telemetryHandler);
  telemetryBus.on("seeded", seededHandler);

  response.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepAlive = setInterval(() => {
    response.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 15_000);
  keepAlive.unref?.();

  request.on("close", () => {
    clearInterval(keepAlive);
    telemetryBus.off("telemetry", telemetryHandler);
    telemetryBus.off("seeded", seededHandler);
  });
}
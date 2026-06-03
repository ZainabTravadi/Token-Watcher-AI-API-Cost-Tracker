import { Router } from "express";
import { listLatestTelemetry } from "../services/telemetryRepository";
import { getSimulatorStatus } from "../services/simulatorService";
import { authenticateUser, requireOwnedWorkspace, type AuthenticatedRequest } from "../middleware/auth";
import { getWorkspaceSimulatorStatus } from "../services/workspaceSimulatorManager";
import { setupWorkspaceSse } from "../services/realtimeStreamService";

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

import { Router } from "express";
import { ingestTelemetry, validateTelemetryPayload } from "../services/ingestService";
import { listLatestRequests } from "../services/requestService";
import { authenticateUser, authenticateSDK, attachWorkspaceOptional, type AuthenticatedRequest } from "../middleware/auth";

export function createRequestsRouter(): Router {
  const router = Router();

  router.get(
    "/requests",
    authenticateUser,
    attachWorkspaceOptional,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: listLatestRequests(request.workspaceId) });
    }
  );

  router.post("/requests", authenticateSDK, (request: AuthenticatedRequest, response) => {
    const created = ingestTelemetry(request.workspaceId!, validateTelemetryPayload(request.body)).rows;

    response.status(201).json({ data: created });
  });

  return router;
}
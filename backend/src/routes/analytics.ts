import { Router } from "express";
import { buildAnalyticsSnapshot, buildRealtimeAnalyticsSnapshot } from "../services/analyticsService";
import { authenticateUser, requireOwnedWorkspace, type AuthenticatedRequest } from "../middleware/auth";

export function createAnalyticsRouter(): Router {
  const router = Router();

  // Protected routes that require authentication and workspace context
  router.get(
      "/analytics/overview",
      authenticateUser,
      requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: buildRealtimeAnalyticsSnapshot(request.workspaceId).overview });
    }
  );

  router.get(
      "/analytics/endpoints",
      authenticateUser,
      requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: buildRealtimeAnalyticsSnapshot(request.workspaceId).endpoints });
    }
  );

  router.get(
      "/analytics/models",
      authenticateUser,
      requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: buildRealtimeAnalyticsSnapshot(request.workspaceId).models });
    }
  );

  router.get(
      "/analytics/recent",
      authenticateUser,
      requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: buildRealtimeAnalyticsSnapshot(request.workspaceId).recent });
    }
  );

  router.get(
      "/analytics/timeline",
      authenticateUser,
      requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: buildAnalyticsSnapshot(request.workspaceId).timeline });
    }
  );

  router.get(
      "/analytics/snapshot",
      authenticateUser,
      requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: buildRealtimeAnalyticsSnapshot(request.workspaceId) });
    }
  );

  return router;
}

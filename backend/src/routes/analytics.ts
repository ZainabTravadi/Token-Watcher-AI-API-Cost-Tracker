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
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: (await buildRealtimeAnalyticsSnapshot(request.workspaceId)).overview });
    }
  );

  router.get(
      "/analytics/endpoints",
      authenticateUser,
      requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: (await buildRealtimeAnalyticsSnapshot(request.workspaceId)).endpoints });
    }
  );

  router.get(
      "/analytics/models",
      authenticateUser,
      requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: (await buildRealtimeAnalyticsSnapshot(request.workspaceId)).models });
    }
  );

  router.get(
      "/analytics/recent",
      authenticateUser,
      requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: (await buildRealtimeAnalyticsSnapshot(request.workspaceId)).recent });
    }
  );

  router.get(
      "/analytics/timeline",
      authenticateUser,
      requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: (await buildAnalyticsSnapshot(request.workspaceId)).timeline });
    }
  );

  router.get(
      "/analytics/snapshot",
      authenticateUser,
      requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }
      response.json({ data: await buildRealtimeAnalyticsSnapshot(request.workspaceId) });
    }
  );

  return router;
}

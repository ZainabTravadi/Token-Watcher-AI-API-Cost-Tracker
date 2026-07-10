import { Router } from "express";
import { buildAnalyticsSnapshot, buildRealtimeAnalyticsSnapshot } from "../services/analyticsService";
import { authenticateWorkspaceAccess, type AuthenticatedRequest } from "../middleware/auth";

export function createAnalyticsRouter(): Router {
  const router = Router();

  // Protected routes that require authentication and workspace context
  router.get(
      "/analytics/overview",
      authenticateWorkspaceAccess("analytics:read"),
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
      authenticateWorkspaceAccess("analytics:read"),
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
      authenticateWorkspaceAccess("analytics:read"),
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
      authenticateWorkspaceAccess("analytics:read"),
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
      authenticateWorkspaceAccess("analytics:read"),
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
      authenticateWorkspaceAccess("analytics:read"),
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

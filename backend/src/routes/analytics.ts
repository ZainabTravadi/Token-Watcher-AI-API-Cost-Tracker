import { Router } from "express";
import { buildAnalyticsSnapshot, buildRealtimeAnalyticsSnapshot } from "../services/analyticsService";
import { authenticateUser, attachWorkspaceOptional, type AuthenticatedRequest } from "../middleware/auth";

export function createAnalyticsRouter(): Router {
  const router = Router();

  // Protected routes that require authentication and workspace context
  router.get(
    "/analytics/overview",
    authenticateUser,
    attachWorkspaceOptional,
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
    attachWorkspaceOptional,
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
    attachWorkspaceOptional,
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
    attachWorkspaceOptional,
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
    attachWorkspaceOptional,
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
    attachWorkspaceOptional,
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
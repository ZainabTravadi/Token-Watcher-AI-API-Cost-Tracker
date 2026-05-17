import { Router } from "express";
import { ingestTelemetry, validateTelemetryPayload } from "../services/ingestService";
import { listRequestLogRecords } from "../services/requestService";
import { authenticateUser, authenticateSDK, attachWorkspaceOptional, type AuthenticatedRequest } from "../middleware/auth";
import { getWorkspace } from "../services/authService";

export function createRequestsRouter(): Router {
  const router = Router();

  router.get(
    "/requests",
    authenticateUser,
    attachWorkspaceOptional,
    (request: AuthenticatedRequest, response) => {
      const workspaceId =
        request.workspaceId ||
        (typeof request.query.workspaceId === "string" ? request.query.workspaceId : undefined);

      if (!request.userId) {
        response.status(401).json({ error: "Unauthorized" });
        return;
      }

      const workspace = workspaceId ? getWorkspace(workspaceId, request.userId) : null;

      if (!workspace) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const page = Number.parseInt(String(request.query.page ?? "1"), 10);
      const limit = Number.parseInt(String(request.query.limit ?? "50"), 10);
      const route = typeof request.query.route === "string" ? request.query.route : undefined;
      const modelQuery = request.query.model;
      const model = Array.isArray(modelQuery)
        ? modelQuery.filter((item): item is string => typeof item === "string")
        : typeof modelQuery === "string"
          ? modelQuery.split(",").map((item) => item.trim()).filter(Boolean)
          : [];
      const cursor = typeof request.query.cursor === "string" ? request.query.cursor : undefined;

      response.json({
        data: listRequestLogRecords(workspace.id, {
          page: Number.isFinite(page) ? page : 1,
          limit: Number.isFinite(limit) ? limit : 50,
          ...(route ? { route } : {}),
          ...(model.length > 0 ? { model } : {}),
          ...(cursor ? { cursor } : {})
        })
      });
    }
  );

  router.post("/requests", authenticateSDK, (request: AuthenticatedRequest, response) => {
    const created = ingestTelemetry(request.workspaceId!, validateTelemetryPayload(request.body)).rows;

    response.status(201).json({ data: created });
  });

  return router;
}
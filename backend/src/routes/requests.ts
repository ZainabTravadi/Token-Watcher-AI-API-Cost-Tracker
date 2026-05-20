import { Router } from "express";
import { ingestTelemetry, validateTelemetryPayload } from "../services/ingestService";
import { listRequestLogRecords } from "../services/requestService";
import { authenticateUser, authenticateSDK, requireOwnedWorkspace, type AuthenticatedRequest } from "../middleware/auth";

export function createRequestsRouter(): Router {
  const router = Router();

  router.get(
    "/requests",
    authenticateUser,
    requireOwnedWorkspace,
    (request: AuthenticatedRequest, response) => {
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
        data: listRequestLogRecords(request.workspaceId!, {
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

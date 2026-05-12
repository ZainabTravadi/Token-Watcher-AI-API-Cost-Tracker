import { Router } from "express";
import { ingestTelemetry, validateTelemetryPayload } from "../services/ingestService";
import { listLatestRequests } from "../services/requestService";

export function createRequestsRouter(): Router {
  const router = Router();

  router.get("/requests", (_request, response) => {
    response.json({ data: listLatestRequests() });
  });

  router.post("/requests", (request, response) => {
    const created = ingestTelemetry(validateTelemetryPayload(request.body)).rows;

    response.status(201).json({ data: created });
  });

  return router;
}
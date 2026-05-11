import { Router } from "express";
import { listLatestRequests, recordRequest } from "../services/requestService";

export function createRequestsRouter(): Router {
  const router = Router();

  router.get("/requests", (_request, response) => {
    response.json({ data: listLatestRequests() });
  });

  router.post("/requests", (request, response) => {
    const created = recordRequest({
      timestamp: Number(request.body.timestamp ?? Date.now()),
      route: String(request.body.route ?? "/"),
      model: String(request.body.model ?? "unknown"),
      provider: String(request.body.provider ?? "unknown"),
      input_tokens: request.body.input_tokens,
      output_tokens: request.body.output_tokens,
      total_tokens: request.body.total_tokens,
      cost_usd: request.body.cost_usd,
      latency_ms: request.body.latency_ms,
      error: request.body.error ?? null
    });

    response.status(201).json({ data: created });
  });

  return router;
}
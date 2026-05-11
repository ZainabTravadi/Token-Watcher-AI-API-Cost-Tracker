import type { Request, Response } from "express";
import { Router } from "express";
import { telemetryBus } from "../services/telemetryBus";
import { listLatestTelemetry } from "../services/telemetryRepository";
import { getSimulatorStatus } from "../services/simulatorService";

export function createTelemetryRouter(): Router {
  const router = Router();

  router.get("/telemetry", (_request, response) => {
    const limit = Number.parseInt(String(_request.query.limit ?? "100"), 10);
    response.json({
      data: listLatestTelemetry(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100),
      simulator: getSimulatorStatus()
    });
  });

  router.get("/telemetry/status", (_request, response) => {
    response.json({ data: getSimulatorStatus() });
  });

  router.get("/telemetry/stream", (request, response) => {
    setupSse(request, response);
  });

  return router;
}

function setupSse(request: Request, response: Response): void {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  const send = (event: string, payload: unknown): void => {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const telemetryHandler = (record: unknown): void => send("telemetry", record);
  const seededHandler = (count: number): void => send("seeded", { count });

  telemetryBus.on("telemetry", telemetryHandler);
  telemetryBus.on("seeded", seededHandler);

  response.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepAlive = setInterval(() => {
    response.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 15_000);
  keepAlive.unref?.();

  request.on("close", () => {
    clearInterval(keepAlive);
    telemetryBus.off("telemetry", telemetryHandler);
    telemetryBus.off("seeded", seededHandler);
  });
}
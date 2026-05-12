import { Router } from "express";
import { getConfig } from "../config/env";
import { getTelemetryCount } from "../services/telemetryRepository";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    const config = getConfig();

    response.json({
      status: "ok",
      database: "connected",
      telemetry: "sdk-ingested",
      telemetryRows: getTelemetryCount(),
      environment: config.nodeEnv,
      port: config.port
    });
  });

  return router;
}
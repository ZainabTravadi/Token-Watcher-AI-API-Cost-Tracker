import { Router } from "express";
import { buildAnalyticsSnapshot, buildRealtimeAnalyticsSnapshot } from "../services/analyticsService";

export function createAnalyticsRouter(): Router {
  const router = Router();

  router.get("/analytics/overview", (_request, response) => {
    response.json({ data: buildRealtimeAnalyticsSnapshot().overview });
  });

  router.get("/analytics/endpoints", (_request, response) => {
    response.json({ data: buildRealtimeAnalyticsSnapshot().endpoints });
  });

  router.get("/analytics/models", (_request, response) => {
    response.json({ data: buildRealtimeAnalyticsSnapshot().models });
  });

  router.get("/analytics/recent", (_request, response) => {
    response.json({ data: buildRealtimeAnalyticsSnapshot().recent });
  });

  router.get("/analytics/timeline", (_request, response) => {
    response.json({ data: buildAnalyticsSnapshot().timeline });
  });

  router.get("/analytics/snapshot", (_request, response) => {
    response.json({ data: buildRealtimeAnalyticsSnapshot() });
  });

  return router;
}
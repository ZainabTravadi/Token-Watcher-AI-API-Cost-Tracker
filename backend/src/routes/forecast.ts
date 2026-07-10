import { Router } from "express";
import { authenticateWorkspaceAccess, type AuthenticatedRequest } from "../middleware/auth";
import { generateBudgetForecast, generateForecast, generateRequestForecast, generateSpendForecast } from "../services/forecastService";

export function createForecastRouter(): Router {
  const router = Router();

  router.get(
    "/forecast",
    authenticateWorkspaceAccess("forecast:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        response.json({ data: await generateForecast(request.workspaceId!) });
      } catch (error) {
        console.error("Forecast error:", error);
        response.status(500).json({ error: "Failed to generate forecast" });
      }
    }
  );

  router.get(
    "/forecast/spend",
    authenticateWorkspaceAccess("forecast:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        response.json({ data: await generateSpendForecast(request.workspaceId!) });
      } catch (error) {
        console.error("Spend forecast error:", error);
        response.status(500).json({ error: "Failed to generate spend forecast" });
      }
    }
  );

  router.get(
    "/forecast/requests",
    authenticateWorkspaceAccess("forecast:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        response.json({ data: await generateRequestForecast(request.workspaceId!) });
      } catch (error) {
        console.error("Request forecast error:", error);
        response.status(500).json({ error: "Failed to generate request forecast" });
      }
    }
  );

  router.get(
    "/forecast/budget",
    authenticateWorkspaceAccess("forecast:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        response.json({ data: await generateBudgetForecast(request.workspaceId!) });
      } catch (error) {
        console.error("Budget forecast error:", error);
        response.status(500).json({ error: "Failed to generate budget forecast" });
      }
    }
  );

  return router;
}

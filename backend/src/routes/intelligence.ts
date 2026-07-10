import { Router } from "express";
import { authenticateWorkspaceAccess, type AuthenticatedRequest } from "../middleware/auth";
import { detectAnomalies } from "../services/anomalyService";
import { calculateEfficiencyScore } from "../services/efficiencyScoreService";
import { generateRecommendations } from "../services/recommendationService";
import { analyzeRootCause, validateRootCauseRequest } from "../services/rootCauseService";

export function createIntelligenceRouter(): Router {
  const router = Router();

  router.get(
    "/intelligence/recommendations",
    authenticateWorkspaceAccess("recommendations:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        response.json({ data: await generateRecommendations(request.workspaceId!) });
      } catch (error) {
        console.error("Recommendations error:", error);
        response.status(500).json({ error: "Failed to generate recommendations" });
      }
    }
  );

  router.get(
    "/intelligence/efficiency-score",
    authenticateWorkspaceAccess("recommendations:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        response.json({ data: await calculateEfficiencyScore(request.workspaceId!) });
      } catch (error) {
        console.error("Efficiency score error:", error);
        response.status(500).json({ error: "Failed to calculate efficiency score" });
      }
    }
  );

  router.get(
    "/intelligence/anomalies",
    authenticateWorkspaceAccess("recommendations:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        response.json({ data: await detectAnomalies(request.workspaceId!) });
      } catch (error) {
        console.error("Anomaly detection error:", error);
        response.status(500).json({ error: "Failed to detect anomalies" });
      }
    }
  );

  router.post(
    "/intelligence/root-cause",
    authenticateWorkspaceAccess("recommendations:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        const { anomaly } = validateRootCauseRequest(request.body);
        response.json({ data: await analyzeRootCause(request.workspaceId!, anomaly) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to analyze root cause";
        const status = message.includes("required") || message.includes("must be") ? 400 : 500;
        if (status >= 500) {
          console.error("Root cause analysis error:", error);
        }
        response.status(status).json({ error: message });
      }
    }
  );

  return router;
}

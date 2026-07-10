import { Router } from "express";
import { authenticateWorkspaceAccess, type AuthenticatedRequest } from "../middleware/auth";
import { generateInsightsForWorkspace } from "../services/aiInsightsService";

export function createAiRouter(): Router {
  const router = Router();

  router.post(
    "/ai/insights",
    authenticateWorkspaceAccess("analytics:read"),
    async (request: AuthenticatedRequest, response) => {
      try {
        if (!request.workspaceId) {
          response.status(400).json({ error: "Workspace ID required" });
          return;
        }

        const { insights, summary } = await generateInsightsForWorkspace(request.workspaceId);
        response.json({ data: { insights, summary } });
      } catch (err) {
        console.error("AI insights error:", err);
        response.status(500).json({ error: "Failed to generate insights" });
      }
    }
  );

  return router;
}

import { Router, type Response } from "express";
import { authenticateUser, requireOwnedWorkspace, type AuthenticatedRequest } from "../middleware/auth";
import {
  runCopilotChat,
  runCopilotExplain,
  runCopilotForecast,
  runCopilotReport,
  validateCopilotRequest
} from "../services/copilotService";
import { parseReportType } from "../services/reportService";
import type { IntelligenceAnomaly } from "../services/anomalyService";

export function createCopilotRouter(): Router {
  const router = Router();

  router.post("/copilot/chat", authenticateUser, requireOwnedWorkspace, async (request: AuthenticatedRequest, response) => {
    try {
      response.json({ data: await runCopilotChat(request.workspaceId!, validateCopilotRequest(request.body)) });
    } catch (error) {
      handleCopilotError(response, error);
    }
  });

  router.post("/copilot/stream", authenticateUser, requireOwnedWorkspace, async (request: AuthenticatedRequest, response) => {
    try {
      const result = await runCopilotChat(request.workspaceId!, validateCopilotRequest(request.body));
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");
      writeSse(response, "metadata", {
        conversationId: result.conversationId,
        confidence: result.confidence,
        toolsUsed: result.toolsUsed,
        sourceMetrics: result.sourceMetrics
      });
      for (const token of tokenize(result.answer)) {
        writeSse(response, "token", { token });
      }
      writeSse(response, "done", { conversationId: result.conversationId });
      response.end();
    } catch (error) {
      writeSse(response, "error", { error: error instanceof Error ? error.message : "Copilot stream failed" });
      response.end();
    }
  });

  router.post("/copilot/report", authenticateUser, requireOwnedWorkspace, async (request: AuthenticatedRequest, response) => {
    try {
      const type = parseReportType(request.body?.type);
      response.json({ data: await runCopilotReport(request.workspaceId!, type, request.body) });
    } catch (error) {
      handleCopilotError(response, error);
    }
  });

  router.post("/copilot/explain", authenticateUser, requireOwnedWorkspace, async (request: AuthenticatedRequest, response) => {
    try {
      const anomaly = isAnomaly(request.body?.anomaly) ? request.body.anomaly : undefined;
      response.json({ data: await runCopilotExplain(request.workspaceId!, anomaly, request.body) });
    } catch (error) {
      handleCopilotError(response, error);
    }
  });

  router.post("/copilot/forecast", authenticateUser, requireOwnedWorkspace, async (request: AuthenticatedRequest, response) => {
    try {
      response.json({ data: await runCopilotForecast(request.workspaceId!, request.body) });
    } catch (error) {
      handleCopilotError(response, error);
    }
  });

  return router;
}

function writeSse(response: Response, event: string, data: unknown): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function tokenize(answer: string): string[] {
  return answer.split(/(\s+)/).filter((part) => part.length > 0);
}

function handleCopilotError(response: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Copilot request failed";
  const status = message.includes("required") ? 400 : 500;
  if (status >= 500) {
    console.error("Copilot error:", error);
  }
  response.status(status).json({ error: message });
}

function isAnomaly(value: unknown): value is IntelligenceAnomaly {
  if (!value || typeof value !== "object") return false;
  const anomaly = value as Partial<IntelligenceAnomaly>;
  return typeof anomaly.id === "string" && typeof anomaly.title === "string" && typeof anomaly.description === "string" && Boolean(anomaly.affectedResource);
}

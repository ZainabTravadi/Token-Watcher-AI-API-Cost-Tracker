import { Router } from "express";
import { authenticateUser, requireOwnedWorkspace, type AuthenticatedRequest } from "../middleware/auth";
import { exportReport, generateReport, parseExportFormat, parseReportType, type ReportType } from "../services/reportService";

export function createReportsRouter(): Router {
  const router = Router();

  router.get("/reports/executive", authenticateUser, requireOwnedWorkspace, reportHandler("executive"));
  router.get("/reports/weekly", authenticateUser, requireOwnedWorkspace, reportHandler("weekly"));
  router.get("/reports/monthly", authenticateUser, requireOwnedWorkspace, reportHandler("monthly"));
  router.get("/reports/budget", authenticateUser, requireOwnedWorkspace, reportHandler("budget"));
  router.get("/reports/infrastructure", authenticateUser, requireOwnedWorkspace, reportHandler("infrastructure"));
  router.get("/reports/optimization", authenticateUser, requireOwnedWorkspace, reportHandler("optimization"));
  router.get("/reports/governance", authenticateUser, requireOwnedWorkspace, reportHandler("governance"));

  router.get(
    "/reports/export",
    authenticateUser,
    requireOwnedWorkspace,
    async (request: AuthenticatedRequest, response) => {
      try {
        const type = parseReportType(request.query.type);
        const format = parseExportFormat(request.query.format);
        const exported = await exportReport(request.workspaceId!, type, format);
        response.setHeader("Content-Type", exported.contentType);
        response.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
        response.send(exported.body);
      } catch (error) {
        console.error("Report export error:", error);
        response.status(500).json({ error: "Failed to export report" });
      }
    }
  );

  return router;
}

function reportHandler(type: ReportType) {
  return async (request: AuthenticatedRequest, response: Parameters<Parameters<Router["get"]>[1]>[1]) => {
    try {
      response.json({ data: await generateReport(request.workspaceId!, type) });
    } catch (error) {
      console.error(`${type} report error:`, error);
      response.status(500).json({ error: "Failed to generate report" });
    }
  };
}

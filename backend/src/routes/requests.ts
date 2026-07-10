import { Router } from "express";
import { ingestTelemetry, validateTelemetryPayload } from "../services/ingestService";
import { listRequestLogRecords } from "../services/requestService";
import { generateTelemetryPdf } from "../services/telemetryPdfService";
import { authenticateSDK, authenticateWorkspaceAccess, type AuthenticatedRequest } from "../middleware/auth";
import { listForExport, type ExportTelemetryQuery } from "../services/telemetryRepository";

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function readNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readDayStart(value: unknown): number | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readDayEnd(value: unknown): number | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getStatusLabel(error: string | null): string {
  if (!error) return "200";
  const normalized = error.toLowerCase();
  if (normalized.includes("429")) return "429";
  if (normalized.includes("500")) return "500";
  return "ERR";
}

export function createRequestsRouter(): Router {
  const router = Router();

  router.get(
    "/requests",
    authenticateWorkspaceAccess("requests:read"),
    async (request: AuthenticatedRequest, response) => {
      const page = Number.parseInt(String(request.query.page ?? "1"), 10);
      const limit = Number.parseInt(String(request.query.limit ?? "50"), 10);
      const route = typeof request.query.route === "string" ? request.query.route : undefined;
      const provider = typeof request.query.provider === "string" ? request.query.provider : undefined;
      const routes = readStringArray(request.query.endpoint);
      const providers = readStringArray(request.query.providers ?? request.query.provider);
      const model = readStringArray(request.query.model);
      const status = readStringArray(request.query.status);
      const workspace = readStringArray(request.query.workspace);
      const cursor = typeof request.query.cursor === "string" ? request.query.cursor : undefined;
      const search = typeof request.query.search === "string" ? request.query.search : undefined;
      const sortBy = typeof request.query.sortBy === "string" ? request.query.sortBy : undefined;
      const sortDir = request.query.sortDir === "asc" ? "asc" : request.query.sortDir === "desc" ? "desc" : undefined;
      const from = readDayStart(request.query.from);
      const to = readDayEnd(request.query.to);
      const minLatency = readNumber(request.query.minLatency);
      const maxLatency = readNumber(request.query.maxLatency);
      const minCost = readNumber(request.query.minCost);
      const maxCost = readNumber(request.query.maxCost);
      const minTokens = readNumber(request.query.minTokens);
      const maxTokens = readNumber(request.query.maxTokens);

      response.json({
        data: await listRequestLogRecords(request.workspaceId!, {
          page: Number.isFinite(page) ? page : 1,
          limit: Number.isFinite(limit) ? limit : 50,
          ...(route ? { route } : {}),
          ...(provider ? { provider } : {}),
          ...(routes.length > 0 ? { routes } : {}),
          ...(providers.length > 0 ? { providers } : {}),
          ...(model.length > 0 ? { model } : {}),
          ...(status.length > 0 ? { status } : {}),
          ...(workspace.length > 0 ? { workspace } : {}),
          ...(cursor ? { cursor } : {}),
          ...(search ? { search } : {}),
          ...(from !== undefined ? { from } : {}),
          ...(to !== undefined ? { to } : {}),
          ...(minLatency !== undefined ? { minLatency } : {}),
          ...(maxLatency !== undefined ? { maxLatency } : {}),
          ...(minCost !== undefined ? { minCost } : {}),
          ...(maxCost !== undefined ? { maxCost } : {}),
          ...(minTokens !== undefined ? { minTokens } : {}),
          ...(maxTokens !== undefined ? { maxTokens } : {}),
          ...(sortBy ? { sortBy: sortBy as any } : {}),
          ...(sortDir ? { sortDir } : {})
        })
      });
    }
  );

  router.get(
    "/requests/export",
    authenticateWorkspaceAccess("requests:read"),
    async (request: AuthenticatedRequest, response) => {
      if (!request.workspaceId) {
        response.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const format = String(request.query.format ?? "csv");
      const from = typeof request.query.from === "string" && request.query.from ? request.query.from : "1970-01-01";
      const to = typeof request.query.to === "string" && request.query.to ? request.query.to : "2999-12-31";
      const minLatency = readNumber(request.query.minLatency);
      const maxLatency = readNumber(request.query.maxLatency);
      const minCost = readNumber(request.query.minCost);
      const maxCost = readNumber(request.query.maxCost);
      const minTokens = readNumber(request.query.minTokens);
      const maxTokens = readNumber(request.query.maxTokens);
      const query: ExportTelemetryQuery = {
        from,
        to,
        providers: readStringArray(request.query.provider),
        models: readStringArray(request.query.model),
        endpoints: readStringArray(request.query.endpoint ?? request.query.route),
        statuses: readStringArray(request.query.status),
        workspaces: readStringArray(request.query.workspace),
        ...(typeof request.query.search === "string" ? { search: request.query.search } : {}),
        ...(minLatency !== undefined ? { minLatency } : {}),
        ...(maxLatency !== undefined ? { maxLatency } : {}),
        ...(minCost !== undefined ? { minCost } : {}),
        ...(maxCost !== undefined ? { maxCost } : {}),
        ...(minTokens !== undefined ? { minTokens } : {}),
        ...(maxTokens !== undefined ? { maxTokens } : {}),
        ...(typeof request.query.sortBy === "string" ? { sortBy: request.query.sortBy as any } : {}),
        ...(request.query.sortDir === "asc" ? { sortDir: "asc" as const } : request.query.sortDir === "desc" ? { sortDir: "desc" as const } : {}),
        limit: 100000
      };
      const rows = await listForExport(request.workspaceId, query);
      const exportRows = rows.map((row) => ({
        timestamp: row.timestamp,
        workspace_id: row.workspace_id,
        provider: row.provider,
        model: row.model,
        endpoint: row.route,
        status: getStatusLabel(row.error),
        requests: 1,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        total_tokens: row.total_tokens,
        cost_usd: row.cost_usd,
        latency_ms: row.latency_ms,
      }));

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      if (format === "pdf") {
        const pdfBuffer = generateTelemetryPdf(exportRows);
        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Disposition", `attachment; filename="requests-${timestamp}.pdf"`);
        response.send(pdfBuffer);
        return;
      }

      if (format === "json") {
        response.setHeader("Content-Type", "application/json;charset=utf-8");
        response.setHeader("Content-Disposition", `attachment; filename="requests-${timestamp}.json"`);
        response.send(JSON.stringify(rows, null, 2));
        return;
      }

      const headers = ["id", "timestamp", "workspace_id", "provider", "model", "endpoint", "status", "input_tokens", "output_tokens", "total_tokens", "cost_usd", "latency_ms", "error", "metadata"];
      const escapeCsv = (value: unknown) => {
        const text = value === null || value === undefined ? "" : String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const body = rows.map((row) =>
        headers.map((header) => escapeCsv(header === "timestamp" ? new Date(row.timestamp).toISOString() : header === "endpoint" ? row.route : (row as any)[header])).join(",")
      );
      response.setHeader("Content-Type", "text/csv;charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="requests-${timestamp}.csv"`);
      response.send([headers.join(","), ...body].join("\n"));
    }
  );

  router.post("/requests", authenticateSDK, async (request: AuthenticatedRequest, response) => {
    const created = (await ingestTelemetry(request.workspaceId!, validateTelemetryPayload(request.body))).rows;

    response.status(201).json({ data: created });
  });

  return router;
}

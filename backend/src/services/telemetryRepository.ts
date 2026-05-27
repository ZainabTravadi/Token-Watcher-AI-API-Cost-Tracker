import { getDatabase } from "../db/database";
import { getWorkspace } from "./authService";
import type {
  AnalyticsEndpointRow,
  AnalyticsModelRow,
  AnalyticsRecentRow,
  AnalyticsSnapshot,
  TelemetryDimensions,
  TelemetryRecord
} from "../types/telemetry";
import type { RequestLogQuery, RequestLogResponse } from "../types/requests";

type TelemetryRow = TelemetryRecord;

const insertTelemetrySql = `
INSERT INTO requests (
  workspace_id,
  timestamp,
  route,
  model,
  provider,
  input_tokens,
  output_tokens,
  total_tokens,
  cost_usd,
  latency_ms,
  error,
  metadata
) VALUES (@workspace_id, @timestamp, @route, @model, @provider, @input_tokens, @output_tokens, @total_tokens, @cost_usd, @latency_ms, @error, @metadata);
`;

export function insertTelemetry(record: Omit<TelemetryRecord, "id">): TelemetryRecord {
  const db = getDatabase();
  const statement = db.prepare(insertTelemetrySql);

  const result = statement.run({ ...record, metadata: record.metadata ?? null });

  return {
    id: Number(result.lastInsertRowid),
    ...record
  };
}

export function insertTelemetryBatch(records: Array<Omit<TelemetryRecord, "id">>): TelemetryRecord[] {
  const db = getDatabase();
  const insert = db.prepare(insertTelemetrySql);
  const transaction = db.transaction((items: Array<Omit<TelemetryRecord, "id">>) =>
    items.map((item) => {
      const result = insert.run({ ...item, metadata: item.metadata ?? null });
      return {
        id: Number(result.lastInsertRowid),
        ...item
      };
    })
  );

  return transaction(records) as TelemetryRecord[];
}

export function listLatestTelemetry(workspaceId: string, limit = 100): TelemetryRow[] {
  const db = getDatabase();
  const sql = `
    SELECT
      id,
      workspace_id,
      timestamp,
      route,
      model,
      provider,
      input_tokens,
      output_tokens,
      total_tokens,
      cost_usd,
      latency_ms,
      error,
      metadata
    FROM requests
    WHERE workspace_id = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT ?;
  `;
  return db.prepare(sql).all(workspaceId, limit) as TelemetryRow[];
}

export function listRequestLog(workspaceId: string, query: RequestLogQuery = {}): RequestLogResponse {
  const db = getDatabase();
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(200, Math.max(1, Math.trunc(query.limit ?? 50)));
  const route = query.route && query.route !== "all" ? query.route : undefined;
  const provider = query.provider && query.provider !== "all" ? query.provider : undefined;
  const models = (query.model ?? []).filter(Boolean);

  const filters: string[] = ["workspace_id = ?"];
  const params: Array<string | number> = [workspaceId];
  const countParams: Array<string | number> = [workspaceId];

  if (route) {
    filters.push("route = ?");
    params.push(route);
    countParams.push(route);
  }

  if (provider) {
    filters.push("provider = ?");
    params.push(provider);
    countParams.push(provider);
  }

  if (models.length > 0) {
    filters.push(`model IN (${models.map(() => "?").join(", ")})`);
    params.push(...models);
    countParams.push(...models);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const cursor = typeof query.cursor === "string" && query.cursor.includes(":") ? query.cursor : null;
  let cursorClause = "";
  const cursorParams: Array<number> = [];
  if (cursor) {
    const [cursorTimestamp, cursorId] = cursor.split(":").map((value) => Number(value));
    if (Number.isFinite(cursorTimestamp) && Number.isFinite(cursorId)) {
      const safeCursorTimestamp = cursorTimestamp as number;
      const safeCursorId = cursorId as number;
      cursorClause = ` AND (timestamp < ? OR (timestamp = ? AND id < ?))`;
      cursorParams.push(safeCursorTimestamp, safeCursorTimestamp, safeCursorId);
    }
  }

  const countSql = `SELECT COUNT(*) AS count FROM requests ${where};`;
  const total = db.prepare(countSql).get(...countParams) as { count: number };

  const offset = cursor ? 0 : (page - 1) * limit;
  const logSql = `
    SELECT
      id,
      workspace_id,
      timestamp,
      route,
      model,
      provider,
      input_tokens,
      output_tokens,
      total_tokens,
      cost_usd,
      latency_ms,
      error,
      metadata
    FROM requests
    ${where}
    ${cursorClause}
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
    ${cursor ? "" : "OFFSET ?"};
  `;

  const rows = cursor
    ? (db.prepare(logSql).all(...params, ...cursorParams, limit) as TelemetryRow[])
    : (db.prepare(logSql).all(...params, limit, offset) as TelemetryRow[]);

  const lastRow = rows.at(-1);
  const nextCursor = lastRow ? `${lastRow.timestamp}:${lastRow.id}` : null;

  return {
    data: rows,
    page,
    limit,
    total: total?.count ?? 0,
    hasMore: cursor ? rows.length === limit : page * limit < (total?.count ?? 0),
    nextCursor
  };
}

export function getAnalyticsSnapshot(workspaceId: string, hours = 24): AnalyticsSnapshot {
  const db = getDatabase();
  const since = Date.now() - hours * 60 * 60 * 1000;
  const today = startOfToday();

  // Overview stats for today
  const overviewSql = `
    SELECT
      COUNT(*) AS requestsToday,
      COALESCE(SUM(cost_usd), 0) AS spendToday,
      COALESCE(AVG(cost_usd), 0) AS avgCostPerRequest,
      COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END), 0) AS errorCount,
      COALESCE(SUM(CASE WHEN error LIKE 'HTTP_429%' THEN 1 ELSE 0 END), 0) AS errors429,
      COALESCE(SUM(CASE WHEN error LIKE 'HTTP_500%' THEN 1 ELSE 0 END), 0) AS errors500
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ?;
  `;

  const endpointSql = `
    SELECT
      route,
      COUNT(*) AS requests,
      COALESCE(SUM(cost_usd), 0) AS cost_usd,
      COALESCE(AVG(cost_usd), 0) AS avg_cost_usd,
      COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ?
    GROUP BY route
    ORDER BY cost_usd DESC, requests DESC;
  `;

  const modelSql = `
    SELECT
      model,
      provider,
      COUNT(*) AS requests,
      COALESCE(SUM(total_tokens), 0) AS tokens,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(cost_usd), 0) AS cost_usd,
      COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ?
    GROUP BY model, provider
    ORDER BY cost_usd DESC, requests DESC;
  `;

  const recentSql = `
    SELECT
      timestamp,
      route,
      model,
      provider,
      input_tokens,
      output_tokens,
      cost_usd,
      error
    FROM requests
    WHERE workspace_id = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT 12;
  `;

  const timelineSql = `
    SELECT
      CAST(strftime('%Y-%m-%dT%H:00:00Z', datetime(timestamp / 1000, 'unixepoch')) AS TEXT) AS bucket,
      COUNT(*) AS requests,
      COALESCE(SUM(cost_usd), 0) AS cost_usd,
      COALESCE(AVG(latency_ms), 0) AS latency_ms
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ?
    GROUP BY bucket
    ORDER BY bucket ASC;
  `;

  const dimensions = listTelemetryDimensions(workspaceId);

  const overviewRow = db.prepare(overviewSql).get(workspaceId, today) as {
    requestsToday: number;
    spendToday: number;
    avgCostPerRequest: number;
    errorCount: number;
    errors429: number;
    errors500: number;
  };

  const endpoints = db.prepare(endpointSql).all(workspaceId, since) as AnalyticsEndpointRow[];
  const models = db.prepare(modelSql).all(workspaceId, since) as AnalyticsModelRow[];
  const recentRaw = db.prepare(recentSql).all(workspaceId) as Array<{
    timestamp: number;
    route: string;
    model: string;
    provider: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    error: string | null;
  }>;
  const timeline = db.prepare(timelineSql).all(workspaceId, since) as AnalyticsSnapshot["timeline"];

  const recent: AnalyticsRecentRow[] = recentRaw.map((row) => ({
    ts: new Date(row.timestamp).toISOString().slice(0, 19).replace("T", " "),
    endpoint: row.route as AnalyticsRecentRow["endpoint"],
    model: row.model as AnalyticsRecentRow["model"],
    provider: row.provider as AnalyticsRecentRow["provider"],
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cost: row.cost_usd,
    status: row.error ? (row.error.startsWith("HTTP_429") ? "429" : row.error.startsWith("HTTP_500") ? "500" : "ERR") : "200"
  }));

  const requestsToday = overviewRow?.requestsToday ?? 0;
  const spendToday = overviewRow?.spendToday ?? 0;
  const avgCostPerRequest = overviewRow?.avgCostPerRequest ?? 0;
  const errorCount = overviewRow?.errorCount ?? 0;
  const workspaceBudget = getWorkspace(workspaceId)?.monthly_budget ?? 100;

  return {
    overview: {
      spendToday,
      requestsToday,
      avgCostPerRequest,
      budget: workspaceBudget,
      errorRate: requestsToday > 0 ? errorCount / requestsToday : 0,
      errors429: overviewRow?.errors429 ?? 0,
      errors500: overviewRow?.errors500 ?? 0
    },
    endpoints,
    models,
    recent,
    timeline,
    dimensions
  };
}

export function listTelemetryDimensions(workspaceId: string): TelemetryDimensions {
  const db = getDatabase();
  const distinct = (column: "model" | "provider" | "route"): string[] =>
    (db.prepare(`
      SELECT DISTINCT ${column} AS value
      FROM requests
      WHERE workspace_id = ? AND ${column} IS NOT NULL AND TRIM(${column}) != ''
      ORDER BY value COLLATE NOCASE ASC;
    `).all(workspaceId) as Array<{ value: string }>).map((row) => row.value);

  return {
    models: distinct("model"),
    providers: distinct("provider"),
    routes: distinct("route")
  };
}

export function hasTelemetryRows(workspaceId?: string): boolean {
  const db = getDatabase();
  let sql = "SELECT COUNT(*) AS count FROM requests";
  let params: any[] = [];

  if (workspaceId) {
    sql += " WHERE workspace_id = ?";
    params = [workspaceId];
  }

  const row = db.prepare(sql + ";").get(...params) as { count: number };
  return row.count > 0;
}

export function getTelemetryCount(workspaceId?: string): number {
  const db = getDatabase();
  let sql = "SELECT COUNT(*) AS count FROM requests";
  let params: any[] = [];

  if (workspaceId) {
    sql += " WHERE workspace_id = ?";
    params = [workspaceId];
  }

  const row = db.prepare(sql + ";").get(...params) as { count: number };
  return row.count;
}

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

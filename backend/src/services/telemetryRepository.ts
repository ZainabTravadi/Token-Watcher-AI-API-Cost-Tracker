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
) VALUES (@workspace_id, @timestamp, @route, @model, @provider, @input_tokens, @output_tokens, @total_tokens, @cost_usd, @latency_ms, @error, @metadata)
RETURNING id;
`;

export async function insertTelemetry(record: Omit<TelemetryRecord, "id">): Promise<TelemetryRecord> {
  const db = getDatabase();
  const statement = db.prepare(insertTelemetrySql);

  const result = await statement.run({ ...record, metadata: record.metadata ?? null });

  return {
    id: Number(result.lastInsertId),
    ...record
  };
}

export async function insertTelemetryBatch(records: Array<Omit<TelemetryRecord, "id">>): Promise<TelemetryRecord[]> {
  const db = getDatabase();
  const insert = db.prepare(insertTelemetrySql);
  return await db.transaction(async () => {
    const rows: TelemetryRecord[] = [];
    for (const item of records) {
      const result = await insert.run({ ...item, metadata: item.metadata ?? null });
      rows.push({
        id: Number(result.lastInsertId),
        ...item
      });
    }
    return rows;
  });
}

export async function listLatestTelemetry(workspaceId: string, limit = 100): Promise<TelemetryRow[]> {
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
  return (await db.prepare(sql).all<TelemetryRow>(workspaceId, limit)).map(normalizeTelemetryRow);
}

export async function listRequestLog(workspaceId: string, query: RequestLogQuery = {}): Promise<RequestLogResponse> {
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
  const total = await db.prepare(countSql).get<{ count: string | number }>(...countParams);

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
    ? await db.prepare(logSql).all<TelemetryRow>(...params, ...cursorParams, limit)
    : await db.prepare(logSql).all<TelemetryRow>(...params, limit, offset);
  const normalizedRows = rows.map(normalizeTelemetryRow);

  const lastRow = normalizedRows.at(-1);
  const nextCursor = lastRow ? `${lastRow.timestamp}:${lastRow.id}` : null;

  return {
    data: normalizedRows,
    page,
    limit,
    total: Number(total?.count ?? 0),
    hasMore: cursor ? normalizedRows.length === limit : page * limit < Number(total?.count ?? 0),
    nextCursor
  };
}

export async function getAnalyticsSnapshot(workspaceId: string, hours = 24): Promise<AnalyticsSnapshot> {
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
      to_char(date_trunc('hour', to_timestamp(timestamp / 1000.0) AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS bucket,
      COUNT(*) AS requests,
      COALESCE(SUM(cost_usd), 0) AS cost_usd,
      COALESCE(AVG(latency_ms), 0) AS latency_ms
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ?
    GROUP BY bucket
    ORDER BY bucket ASC;
  `;

  const dimensions = await listTelemetryDimensions(workspaceId);

  const overviewRow = await db.prepare(overviewSql).get<{
    requeststoday: string | number;
    spendtoday: string | number;
    avgcostperrequest: string | number;
    errorcount: string | number;
    errors429: string | number;
    errors500: string | number;
  }>(workspaceId, today);

  const endpoints = (await db.prepare(endpointSql).all<any>(workspaceId, since)).map((row) => ({
    ...row,
    requests: Number(row.requests ?? 0),
    cost_usd: Number(row.cost_usd ?? 0),
    avg_cost_usd: Number(row.avg_cost_usd ?? 0),
    avg_latency_ms: Number(row.avg_latency_ms ?? 0)
  })) as AnalyticsEndpointRow[];
  const models = (await db.prepare(modelSql).all<any>(workspaceId, since)).map((row) => ({
    ...row,
    requests: Number(row.requests ?? 0),
    tokens: Number(row.tokens ?? 0),
    input_tokens: Number(row.input_tokens ?? 0),
    output_tokens: Number(row.output_tokens ?? 0),
    cost_usd: Number(row.cost_usd ?? 0),
    avg_latency_ms: Number(row.avg_latency_ms ?? 0)
  })) as AnalyticsModelRow[];
  const recentRaw = await db.prepare(recentSql).all<{
    timestamp: number;
    route: string;
    model: string;
    provider: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    error: string | null;
  }>(workspaceId);
  const timeline = (await db.prepare(timelineSql).all<any>(workspaceId, since)).map((row) => ({
    bucket: row.bucket,
    requests: Number(row.requests ?? 0),
    cost_usd: Number(row.cost_usd ?? 0),
    latency_ms: Number(row.latency_ms ?? 0)
  })) as AnalyticsSnapshot["timeline"];

  const recent: AnalyticsRecentRow[] = recentRaw.map((row) => ({
    ts: new Date(Number(row.timestamp)).toISOString().slice(0, 19).replace("T", " "),
    endpoint: row.route as AnalyticsRecentRow["endpoint"],
    model: row.model as AnalyticsRecentRow["model"],
    provider: row.provider as AnalyticsRecentRow["provider"],
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cost: row.cost_usd,
    status: row.error ? (row.error.startsWith("HTTP_429") ? "429" : row.error.startsWith("HTTP_500") ? "500" : "ERR") : "200"
  }));

  const requestsToday = Number(overviewRow?.requeststoday ?? 0);
  const spendToday = Number(overviewRow?.spendtoday ?? 0);
  const avgCostPerRequest = Number(overviewRow?.avgcostperrequest ?? 0);
  const errorCount = Number(overviewRow?.errorcount ?? 0);
  const workspaceBudget = (await getWorkspace(workspaceId))?.monthly_budget ?? 100;

  return {
    overview: {
      spendToday,
      requestsToday,
      avgCostPerRequest,
      budget: workspaceBudget,
      errorRate: requestsToday > 0 ? errorCount / requestsToday : 0,
      errors429: Number(overviewRow?.errors429 ?? 0),
      errors500: Number(overviewRow?.errors500 ?? 0)
    },
    endpoints,
    models,
    recent,
    timeline,
    dimensions
  };
}

export async function listTelemetryDimensions(workspaceId: string): Promise<TelemetryDimensions> {
  const db = getDatabase();
  const distinct = async (column: "model" | "provider" | "route"): Promise<string[]> =>
    (await db.prepare(`
      SELECT ${column} AS value
      FROM requests
      WHERE workspace_id = ? AND ${column} IS NOT NULL AND TRIM(${column}) != ''
      GROUP BY ${column}
      ORDER BY LOWER(${column}) ASC;
    `).all<{ value: string }>(workspaceId)).map((row) => row.value);

  return {
    models: await distinct("model"),
    providers: await distinct("provider"),
    routes: await distinct("route")
  };
}

export async function hasTelemetryRows(workspaceId?: string): Promise<boolean> {
  const db = getDatabase();
  let sql = "SELECT COUNT(*) AS count FROM requests";
  let params: any[] = [];

  if (workspaceId) {
    sql += " WHERE workspace_id = ?";
    params = [workspaceId];
  }

  const row = await db.prepare(sql + ";").get<{ count: string | number }>(...params);
  return Number(row?.count ?? 0) > 0;
}

export async function getTelemetryCount(workspaceId?: string): Promise<number> {
  const db = getDatabase();
  let sql = "SELECT COUNT(*) AS count FROM requests";
  let params: any[] = [];

  if (workspaceId) {
    sql += " WHERE workspace_id = ?";
    params = [workspaceId];
  }

  const row = await db.prepare(sql + ";").get<{ count: string | number }>(...params);
  return Number(row?.count ?? 0);
}

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function normalizeTelemetryRow(row: TelemetryRow): TelemetryRow {
  const metadata = row.metadata && typeof row.metadata !== "string" ? JSON.stringify(row.metadata) : row.metadata;
  const normalized: TelemetryRow = {
    ...row,
    id: Number(row.id),
    timestamp: Number(row.timestamp),
    input_tokens: Number(row.input_tokens),
    output_tokens: Number(row.output_tokens),
    total_tokens: Number(row.total_tokens),
    cost_usd: Number(row.cost_usd),
    latency_ms: Number(row.latency_ms),
  };
  if (metadata !== undefined) {
    normalized.metadata = metadata;
  }
  return normalized;
}

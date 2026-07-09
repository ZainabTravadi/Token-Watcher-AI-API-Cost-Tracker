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

export interface ExportTelemetryQuery {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  providers?: string[];
  models?: string[];
  endpoints?: string[];
  statuses?: string[];
  workspaces?: string[];
  search?: string;
  minLatency?: number;
  maxLatency?: number;
  minCost?: number;
  maxCost?: number;
  minTokens?: number;
  maxTokens?: number;
  sortBy?: RequestLogQuery["sortBy"];
  sortDir?: RequestLogQuery["sortDir"];
  limit?: number;
}

export interface TelemetryHistoryBucket {
  bucket_start: number;
  requests: number;
  cost_usd: number;
  avg_cost_usd: number;
  avg_latency_ms: number;
  avg_total_tokens: number;
  errors: number;
}

export type TelemetryResourceKind = "model" | "provider" | "route";

export interface TelemetryResourcePeriodSummary {
  resource: string;
  current_requests: number;
  current_cost_usd: number;
  current_avg_latency_ms: number;
  current_avg_total_tokens: number;
  current_errors: number;
  baseline_requests: number;
  baseline_cost_usd: number;
  baseline_avg_latency_ms: number;
  baseline_avg_total_tokens: number;
  baseline_errors: number;
}

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

export async function listTelemetryHistoryBuckets(workspaceId: string, hours = 336, bucketHours = 1): Promise<TelemetryHistoryBucket[]> {
  const db = getDatabase();
  const bucketMs = Math.max(1, Math.trunc(bucketHours)) * 60 * 60 * 1000;
  const since = Date.now() - Math.max(1, Math.trunc(hours)) * 60 * 60 * 1000;
  const sql = `
    SELECT
      FLOOR(timestamp / ?) * ? AS bucket_start,
      COUNT(*) AS requests,
      COALESCE(SUM(cost_usd), 0) AS cost_usd,
      COALESCE(AVG(cost_usd), 0) AS avg_cost_usd,
      COALESCE(AVG(latency_ms), 0) AS avg_latency_ms,
      COALESCE(AVG(total_tokens), 0) AS avg_total_tokens,
      COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END), 0) AS errors
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ?
    GROUP BY bucket_start
    ORDER BY bucket_start ASC;
  `;

  return (await db.prepare(sql).all<any>(bucketMs, bucketMs, workspaceId, since)).map((row) => ({
    bucket_start: Number(row.bucket_start ?? 0),
    requests: Number(row.requests ?? 0),
    cost_usd: Number(row.cost_usd ?? 0),
    avg_cost_usd: Number(row.avg_cost_usd ?? 0),
    avg_latency_ms: Number(row.avg_latency_ms ?? 0),
    avg_total_tokens: Number(row.avg_total_tokens ?? 0),
    errors: Number(row.errors ?? 0)
  }));
}

export async function listTelemetryResourcePeriodSummaries(
  workspaceId: string,
  resourceKind: TelemetryResourceKind,
  currentHours = 24,
  baselineHours = 336
): Promise<TelemetryResourcePeriodSummary[]> {
  const db = getDatabase();
  const currentSince = Date.now() - Math.max(1, Math.trunc(currentHours)) * 60 * 60 * 1000;
  const baselineSince = Date.now() - Math.max(currentHours + 1, Math.trunc(baselineHours)) * 60 * 60 * 1000;
  const column = resourceKind === "route" ? "route" : resourceKind === "provider" ? "provider" : "model";
  const sql = `
    SELECT
      ${column} AS resource,
      COALESCE(SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END), 0) AS current_requests,
      COALESCE(SUM(CASE WHEN timestamp >= ? THEN cost_usd ELSE 0 END), 0) AS current_cost_usd,
      COALESCE(AVG(CASE WHEN timestamp >= ? THEN latency_ms END), 0) AS current_avg_latency_ms,
      COALESCE(AVG(CASE WHEN timestamp >= ? THEN total_tokens END), 0) AS current_avg_total_tokens,
      COALESCE(SUM(CASE WHEN timestamp >= ? AND error IS NOT NULL THEN 1 ELSE 0 END), 0) AS current_errors,
      COALESCE(SUM(CASE WHEN timestamp < ? THEN 1 ELSE 0 END), 0) AS baseline_requests,
      COALESCE(SUM(CASE WHEN timestamp < ? THEN cost_usd ELSE 0 END), 0) AS baseline_cost_usd,
      COALESCE(AVG(CASE WHEN timestamp < ? THEN latency_ms END), 0) AS baseline_avg_latency_ms,
      COALESCE(AVG(CASE WHEN timestamp < ? THEN total_tokens END), 0) AS baseline_avg_total_tokens,
      COALESCE(SUM(CASE WHEN timestamp < ? AND error IS NOT NULL THEN 1 ELSE 0 END), 0) AS baseline_errors
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ? AND ${column} IS NOT NULL AND TRIM(${column}) != ''
    GROUP BY ${column}
    ORDER BY current_cost_usd DESC, current_requests DESC;
  `;

  return (await db.prepare(sql).all<any>(
    currentSince,
    currentSince,
    currentSince,
    currentSince,
    currentSince,
    currentSince,
    currentSince,
    currentSince,
    currentSince,
    currentSince,
    workspaceId,
    baselineSince
  )).map((row) => ({
    resource: String(row.resource ?? ""),
    current_requests: Number(row.current_requests ?? 0),
    current_cost_usd: Number(row.current_cost_usd ?? 0),
    current_avg_latency_ms: Number(row.current_avg_latency_ms ?? 0),
    current_avg_total_tokens: Number(row.current_avg_total_tokens ?? 0),
    current_errors: Number(row.current_errors ?? 0),
    baseline_requests: Number(row.baseline_requests ?? 0),
    baseline_cost_usd: Number(row.baseline_cost_usd ?? 0),
    baseline_avg_latency_ms: Number(row.baseline_avg_latency_ms ?? 0),
    baseline_avg_total_tokens: Number(row.baseline_avg_total_tokens ?? 0),
    baseline_errors: Number(row.baseline_errors ?? 0)
  }));
}

export async function listRequestLog(workspaceId: string, query: RequestLogQuery = {}): Promise<RequestLogResponse> {
  const db = getDatabase();
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(200, Math.max(1, Math.trunc(query.limit ?? 50)));
  const routes = [...(query.routes ?? []), ...(query.route && query.route !== "all" ? [query.route] : [])].filter(Boolean);
  const providers = [...(query.providers ?? []), ...(query.provider && query.provider !== "all" ? [query.provider] : [])].filter(Boolean);
  const models = (query.model ?? []).filter(Boolean);
  const workspaces = (query.workspace ?? []).filter(Boolean);
  const statuses = (query.status ?? []).filter(Boolean);
  const search = query.search?.trim();
  const sort = getRequestSort(query.sortBy, query.sortDir);

  const filters: string[] = ["workspace_id = ?"];
  const params: Array<string | number> = [workspaceId];
  const countParams: Array<string | number> = [workspaceId];

  if (routes.length > 0) {
    filters.push(`route IN (${routes.map(() => "?").join(", ")})`);
    params.push(...routes);
    countParams.push(...routes);
  }

  if (providers.length > 0) {
    filters.push(`provider IN (${providers.map(() => "?").join(", ")})`);
    params.push(...providers);
    countParams.push(...providers);
  }

  if (models.length > 0) {
    filters.push(`model IN (${models.map(() => "?").join(", ")})`);
    params.push(...models);
    countParams.push(...models);
  }

  if (workspaces.length > 0) {
    filters.push(`workspace_id IN (${workspaces.map(() => "?").join(", ")})`);
    params.push(...workspaces);
    countParams.push(...workspaces);
  }

  appendStatusFilters(filters, params, countParams, statuses);
  appendRangeFilter(filters, params, countParams, "timestamp", query.from, query.to);
  appendRangeFilter(filters, params, countParams, "latency_ms", query.minLatency, query.maxLatency);
  appendRangeFilter(filters, params, countParams, "cost_usd", query.minCost, query.maxCost);
  appendRangeFilter(filters, params, countParams, "total_tokens", query.minTokens, query.maxTokens);

  if (search) {
    const normalizedSearch = `%${search.toLowerCase()}%`;
    filters.push(`(
      LOWER(route) LIKE ?
      OR LOWER(model) LIKE ?
      OR LOWER(provider) LIKE ?
      OR CAST(id AS TEXT) LIKE ?
      OR LOWER(COALESCE(error, '')) LIKE ?
      OR LOWER(COALESCE(metadata::text, '')) LIKE ?
    )`);
    params.push(normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch);
    countParams.push(normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const cursor = sort.isDefault && typeof query.cursor === "string" && query.cursor.includes(":") ? query.cursor : null;
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
      ORDER BY ${sort.orderBy}, id ${sort.dir}
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

function getRequestSort(sortBy: RequestLogQuery["sortBy"] = "timestamp", sortDir: RequestLogQuery["sortDir"] = "desc") {
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const sortKey = sortBy && ["timestamp", "cost", "latency", "tokens", "provider", "model", "endpoint", "status"].includes(sortBy)
    ? sortBy
    : "timestamp";
  const column = {
    timestamp: "timestamp",
    cost: "cost_usd",
    latency: "latency_ms",
    tokens: "total_tokens",
    provider: "LOWER(provider)",
    model: "LOWER(model)",
    endpoint: "LOWER(route)",
    status: "CASE WHEN error IS NULL THEN '200' WHEN error LIKE '%429%' THEN '429' WHEN error LIKE '%500%' THEN '500' ELSE 'ERR' END"
  }[sortKey];

  return { orderBy: `${column} ${dir}`, dir, isDefault: sortKey === "timestamp" && dir === "DESC" };
}

function appendRangeFilter(
  filters: string[],
  params: Array<string | number>,
  countParams: Array<string | number>,
  column: string,
  min?: number,
  max?: number
) {
  if (Number.isFinite(min)) {
    filters.push(`${column} >= ?`);
    params.push(min as number);
    countParams.push(min as number);
  }
  if (Number.isFinite(max)) {
    filters.push(`${column} <= ?`);
    params.push(max as number);
    countParams.push(max as number);
  }
}

function appendStatusFilters(filters: string[], params: Array<string | number>, countParams: Array<string | number>, statuses: string[]) {
  if (statuses.length === 0) return;

  const statusConditions: string[] = [];
  for (const status of statuses) {
    if (status === "success" || status === "200") {
      statusConditions.push("error IS NULL");
    } else if (status === "error" || status === "ERR") {
      statusConditions.push("error IS NOT NULL");
    } else if (status === "429") {
      statusConditions.push("error LIKE ?");
      params.push("%429%");
      countParams.push("%429%");
    } else if (status === "500") {
      statusConditions.push("error LIKE ?");
      params.push("%500%");
      countParams.push("%500%");
    }
  }

  if (statusConditions.length > 0) {
    filters.push(`(${statusConditions.join(" OR ")})`);
  }
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

export async function getCurrentMonthSpend(workspaceId: string): Promise<number> {
  const db = getDatabase();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const row = await db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) AS spend
    FROM requests
    WHERE workspace_id = ? AND timestamp >= ?;
  `).get<{ spend: string | number }>(workspaceId, monthStart);
  return Number(row?.spend ?? 0);
}

export async function listForExport(workspaceId: string, query: ExportTelemetryQuery): Promise<TelemetryRow[]> {
  const db = getDatabase();
  
  // Parse date range to timestamps (start of day to end of day)
  const from = new Date(`${query.from}T00:00:00`);
  const to = new Date(`${query.to}T23:59:59`);
  const fromTime = from.getTime();
  const toTime = to.getTime();
  
  // Build WHERE conditions
  const conditions: string[] = ["workspace_id = ?", "timestamp >= ?", "timestamp <= ?"];
  const params: Array<string | number> = [workspaceId, fromTime, toTime];
  
  // Filter by provider
  if (query.providers && query.providers.length > 0) {
    const placeholders = query.providers.map(() => "?").join(",");
    conditions.push(`provider IN (${placeholders})`);
    params.push(...query.providers);
  }
  
  // Filter by model
  if (query.models && query.models.length > 0) {
    const placeholders = query.models.map(() => "?").join(",");
    conditions.push(`model IN (${placeholders})`);
    params.push(...query.models);
  }
  
  // Filter by endpoint (route)
  if (query.endpoints && query.endpoints.length > 0) {
    const placeholders = query.endpoints.map(() => "?").join(",");
    conditions.push(`route IN (${placeholders})`);
    params.push(...query.endpoints);
  }
  
  // Filter by status (error conditions)
  if (query.statuses && query.statuses.length > 0) {
    const statusConditions: string[] = [];
    for (const status of query.statuses) {
      if (status === "success" || status === "200") {
        statusConditions.push("error IS NULL");
      } else if (status === "error" || status === "ERR") {
        statusConditions.push("error IS NOT NULL");
      } else if (status === "429") {
        statusConditions.push("error LIKE ?");
        params.push("%429%");
      } else if (status === "500") {
        statusConditions.push("error LIKE ?");
        params.push("%500%");
      }
    }
    if (statusConditions.length > 0) {
      conditions.push(`(${statusConditions.join(" OR ")})`);
    }
  }

  if (query.workspaces && query.workspaces.length > 0) {
    const placeholders = query.workspaces.map(() => "?").join(",");
    conditions.push(`workspace_id IN (${placeholders})`);
    params.push(...query.workspaces);
  }

  if (Number.isFinite(query.minLatency)) {
    conditions.push("latency_ms >= ?");
    params.push(query.minLatency as number);
  }
  if (Number.isFinite(query.maxLatency)) {
    conditions.push("latency_ms <= ?");
    params.push(query.maxLatency as number);
  }
  if (Number.isFinite(query.minCost)) {
    conditions.push("cost_usd >= ?");
    params.push(query.minCost as number);
  }
  if (Number.isFinite(query.maxCost)) {
    conditions.push("cost_usd <= ?");
    params.push(query.maxCost as number);
  }
  if (Number.isFinite(query.minTokens)) {
    conditions.push("total_tokens >= ?");
    params.push(query.minTokens as number);
  }
  if (Number.isFinite(query.maxTokens)) {
    conditions.push("total_tokens <= ?");
    params.push(query.maxTokens as number);
  }

  if (query.search?.trim()) {
    const normalizedSearch = `%${query.search.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(route) LIKE ?
      OR LOWER(model) LIKE ?
      OR LOWER(provider) LIKE ?
      OR CAST(id AS TEXT) LIKE ?
      OR LOWER(COALESCE(error, '')) LIKE ?
      OR LOWER(COALESCE(metadata::text, '')) LIKE ?
    )`);
    params.push(normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch, normalizedSearch);
  }
  
  const where = conditions.join(" AND ");
  const limit = Math.min(query.limit ?? 10000, 100000); // Max 100k records
  const sort = getRequestSort(query.sortBy, query.sortDir);
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
    WHERE ${where}
    ORDER BY ${sort.orderBy}, id ${sort.dir}
    LIMIT ?
  `;
  
  const rows = await db.prepare(sql).all<TelemetryRow>(...params, limit);
  return rows.map(normalizeTelemetryRow);
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

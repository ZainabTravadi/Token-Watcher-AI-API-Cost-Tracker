import { Pool, PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { getConfig } from "../config/env";
import {
  createRequestsRouteIndexSql,
  createRequestsTableSql,
  createRequestsTimestampIndexSql,
  createRequestsWorkspaceModelTimestampIndexSql,
  createRequestsWorkspaceRouteTimestampIndexSql,
  createRequestsWorkspaceTimestampIndexSql,
  createRequestsWorkspaceErrorTimestampIndexSql,
  createRequestsWorkspaceIndexSql,
  createUsersTableSql,
  createUsersEmailIndexSql,
  createWorkspacesTableSql,
  createWorkspacesUserIdIndexSql,
  createApiKeysTableSql,
  createApiKeysWorkspaceIdIndexSql,
  createApiKeysHashActiveIndexSql,
  createWorkspaceSettingsTableSql
} from "./schema";

export interface RunResult {
  changes: number;
  lastInsertId: number | bigint;
  rows: unknown[];
}

interface PreparedStatement {
  get<T extends QueryResultRow = QueryResultRow>(...params: unknown[]): Promise<T | undefined>;
  all<T extends QueryResultRow = QueryResultRow>(...params: unknown[]): Promise<T[]>;
  run(...params: unknown[]): Promise<RunResult>;
}

export interface PgDatabase {
  name: string;
  pool: Pool;
  exec(sql: string): Promise<void>;
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  prepare(sql: string): PreparedStatement;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}

let database: PgDatabase | null = null;
let activeTransactionClient: PoolClient | null = null;

async function applySchema(db: PgDatabase): Promise<void> {
  await db.exec(createUsersTableSql);
  await db.exec(createUsersEmailIndexSql);
  await db.exec(createWorkspacesTableSql);
  await db.exec(createWorkspacesUserIdIndexSql);
  await db.exec(createApiKeysTableSql);
  await db.exec(createApiKeysWorkspaceIdIndexSql);
  await db.exec(createApiKeysHashActiveIndexSql);
  await db.exec(createWorkspaceSettingsTableSql);

  await ensureSchemaUpdates(db);

  await db.exec(createRequestsTableSql);
  await db.exec(createRequestsTimestampIndexSql);
  await db.exec(createRequestsWorkspaceTimestampIndexSql);
  await db.exec(createRequestsRouteIndexSql);
  await db.exec(createRequestsWorkspaceRouteTimestampIndexSql);
  await db.exec(createRequestsWorkspaceModelTimestampIndexSql);
  await db.exec(createRequestsWorkspaceErrorTimestampIndexSql);
  await db.exec(createRequestsWorkspaceIndexSql);
}

async function ensureSchemaUpdates(db: PgDatabase): Promise<void> {
  await db.exec("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_logout_at BIGINT NOT NULL DEFAULT 0");
  await db.exec("ALTER TABLE IF EXISTS requests ADD COLUMN IF NOT EXISTS metadata JSONB");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS alert_on_latency BOOLEAN NOT NULL DEFAULT false");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS daily_digest BOOLEAN NOT NULL DEFAULT false");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS weekly_report BOOLEAN NOT NULL DEFAULT true");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS latency_threshold_ms INTEGER NOT NULL DEFAULT 2000");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS notification_email TEXT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS last_digest_sent BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS last_weekly_report_sent BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS last_test_email_sent BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS last_high_cost_alert_sent BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS last_error_alert_sent BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS last_latency_alert_sent BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS daily_digest_time TEXT NOT NULL DEFAULT '09:00'");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS digest_timezone TEXT NOT NULL DEFAULT 'UTC'");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS weekly_report_day TEXT NOT NULL DEFAULT 'Monday'");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS weekly_report_time TEXT NOT NULL DEFAULT '08:00'");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS webhook_last_test_at BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS webhook_last_status TEXT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS webhook_last_response_code INTEGER");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ADD COLUMN IF NOT EXISTS webhook_last_response_time_ms INTEGER");
  await db.exec("ALTER TABLE IF EXISTS users ALTER COLUMN created_at TYPE BIGINT, ALTER COLUMN updated_at TYPE BIGINT, ALTER COLUMN last_logout_at TYPE BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspaces ALTER COLUMN monthly_budget TYPE DOUBLE PRECISION, ALTER COLUMN created_at TYPE BIGINT, ALTER COLUMN updated_at TYPE BIGINT");
  await db.exec("ALTER TABLE IF EXISTS api_keys ALTER COLUMN created_at TYPE BIGINT, ALTER COLUMN revoked_at TYPE BIGINT");
  await db.exec("ALTER TABLE IF EXISTS workspace_settings ALTER COLUMN alert_cost_threshold TYPE DOUBLE PRECISION, ALTER COLUMN created_at TYPE BIGINT, ALTER COLUMN updated_at TYPE BIGINT");
  await db.exec("ALTER TABLE IF EXISTS requests ALTER COLUMN timestamp TYPE BIGINT, ALTER COLUMN cost_usd TYPE DOUBLE PRECISION");
}

function createDatabase(): PgDatabase {
  const config = getConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });

  const query = async <T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> => {
    if (activeTransactionClient) {
      return activeTransactionClient.query<T>(sql, params);
    }
    return pool.query<T>(sql, params);
  };

  const db: PgDatabase = {
    name: config.databaseUrl.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@"),
    pool,
    exec: async (sql: string) => {
      await query(sql);
    },
    query,
    prepare: (sql: string) => ({
      get: async <T extends QueryResultRow = QueryResultRow>(...params: unknown[]) => {
        const { text, values } = translateSql(sql, params);
        const result = await query<T>(text, values);
        return result.rows[0] as T | undefined;
      },
      all: async <T extends QueryResultRow = QueryResultRow>(...params: unknown[]) => {
        const { text, values } = translateSql(sql, params);
        const result = await query<T>(text, values);
        return result.rows as T[];
      },
      run: async (...params: unknown[]) => {
        const { text, values } = translateSql(sql, params);
        const result = await query(text, values);
        const row = result.rows[0] as { id?: number | bigint } | undefined;
        return {
          changes: result.rowCount ?? 0,
          lastInsertId: row?.id ?? 0,
          rows: result.rows
        };
      }
    }),
    transaction: async <T>(callback: () => Promise<T>) => {
      if (activeTransactionClient) {
        return callback();
      }
      const client = await pool.connect();
      activeTransactionClient = client;
      try {
        await client.query("BEGIN");
        const result = await callback();
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        activeTransactionClient = null;
        client.release();
      }
    }
  };

  return db;
}

export function getDatabase(): PgDatabase {
  if (!database) {
    database = createDatabase();
  }
  return database;
}

export async function initializeDatabase(): Promise<void> {
  await applySchema(getDatabase());
}

export async function closeDatabase(): Promise<void> {
  if (!database) {
    return;
  }

  await database.pool.end();
  database = null;
}

export function getDatabasePath(): string {
  return getConfig().databasePath;
}

function translateSql(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  const first = params[0];
  if (isPlainObject(first)) {
    const values: unknown[] = [];
    const names = new Map<string, number>();
    const text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
      if (!names.has(name)) {
        names.set(name, values.length + 1);
        values.push((first as Record<string, unknown>)[name]);
      }
      return `$${names.get(name)}`;
    });
    return { text, values: values.map(normalizeValue) };
  }

  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values: params.map(normalizeValue) };
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value;
  }
  if (isJsonString(value)) {
    return value;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
}

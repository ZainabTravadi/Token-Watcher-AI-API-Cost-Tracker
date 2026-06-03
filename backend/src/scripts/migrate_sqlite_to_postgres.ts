#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { closeDatabase, getDatabase, initializeDatabase } from "../db/database";
import { getConfig } from "../config/env";

type SqliteDatabase = {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  close(): void;
};

type SqliteConstructor = new (filename: string, options?: unknown) => SqliteDatabase;

const TABLES = ["users", "workspaces", "api_keys", "workspace_settings", "requests"] as const;

async function main(): Promise<void> {
  const sqlitePath = path.resolve(process.env.SQLITE_PATH ?? getConfig().databasePath);
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }

  const { default: Sqlite } = await import("better-sqlite3") as { default: SqliteConstructor };
  const sqlite = new Sqlite(sqlitePath, { readonly: true });

  await initializeDatabase();
  const pg = getDatabase();

  try {
    await pg.transaction(async () => {
      await pg.exec("TRUNCATE requests, workspace_settings, api_keys, workspaces, users RESTART IDENTITY CASCADE");

      for (const table of TABLES) {
        const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
        for (const row of rows) {
          await insertRow(table, row);
        }
      }

      await pg.exec("SELECT setval(pg_get_serial_sequence('requests', 'id'), COALESCE((SELECT MAX(id) FROM requests), 1), (SELECT COUNT(*) > 0 FROM requests))");
    });

    await verifyCounts(sqlite);
  } finally {
    sqlite.close();
    await closeDatabase();
  }
}

async function insertRow(table: typeof TABLES[number], row: Record<string, unknown>): Promise<void> {
  const pg = getDatabase();
  const columns = Object.keys(row);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  const values = columns.map((column) => normalizeValue(table, column, row[column]));
  await pg.query(sql, values);
}

function normalizeValue(table: string, column: string, value: unknown): unknown {
  if (table === "workspace_settings" && (column === "alert_on_high_cost" || column === "alert_on_errors")) {
    return Boolean(value);
  }
  if (table === "requests" && column === "metadata" && typeof value === "string" && value.trim()) {
    return value;
  }
  return value;
}

async function verifyCounts(sqlite: SqliteDatabase): Promise<void> {
  const pg = getDatabase();
  for (const table of TABLES) {
    const sqliteRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    const pgRow = await pg.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${table}`);
    const sqliteCount = Number(sqliteRow.count);
    const pgCount = Number(pgRow.rows[0]?.count ?? 0);
    if (sqliteCount !== pgCount) {
      throw new Error(`Migration count mismatch for ${table}: SQLite=${sqliteCount} PostgreSQL=${pgCount}`);
    }
    process.stdout.write(`${table}: ${pgCount} rows verified\n`);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

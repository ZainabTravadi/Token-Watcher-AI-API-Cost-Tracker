import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
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

let database: Database | null = null;

function applySchema(db: Database): void {
  // Auth tables
  db.exec(createUsersTableSql);
  db.exec(createUsersEmailIndexSql);
  db.exec(createWorkspacesTableSql);
  db.exec(createWorkspacesUserIdIndexSql);
  db.exec(createApiKeysTableSql);
  db.exec(createApiKeysWorkspaceIdIndexSql);
  db.exec(createApiKeysHashActiveIndexSql);
  db.exec(createWorkspaceSettingsTableSql);
  
  ensureSchemaUpdates(db);
  
  // Requests table
  db.exec(createRequestsTableSql);
  db.exec(createRequestsTimestampIndexSql);
  db.exec(createRequestsWorkspaceTimestampIndexSql);
  db.exec(createRequestsRouteIndexSql);
  db.exec(createRequestsWorkspaceRouteTimestampIndexSql);
  db.exec(createRequestsWorkspaceModelTimestampIndexSql);
  db.exec(createRequestsWorkspaceErrorTimestampIndexSql);
  db.exec(createRequestsWorkspaceIndexSql);
}

function ensureSchemaUpdates(db: Database): void {
  const usersInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!usersInfo.some((column) => column.name === "last_logout_at")) {
    db.exec("ALTER TABLE users ADD COLUMN last_logout_at INTEGER NOT NULL DEFAULT 0");
  }

  const requestsInfo = db.prepare("PRAGMA table_info(requests)").all() as Array<{ name: string }>;
  if (requestsInfo.length > 0 && !requestsInfo.some((column) => column.name === "metadata")) {
    db.exec("ALTER TABLE requests ADD COLUMN metadata TEXT");
  }
}

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const config = getConfig();
  const resolvedDatabasePath = path.resolve(config.databasePath);
  fs.mkdirSync(path.dirname(resolvedDatabasePath), { recursive: true });

  database = new Database(resolvedDatabasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  // Set a busy timeout to reduce immediate failures when the DB is briefly locked
  database.pragma("busy_timeout = 5000");
  // Perform a checkpoint on startup to keep WAL from growing unbounded across restarts
  try {
    // TRUNCATE will try to move WAL contents back into the main DB and shrink the WAL
    database.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // Best-effort only
  }
  applySchema(database);

  return database;
}

export function initializeDatabase(): void {
  applySchema(getDatabase());
}

export function closeDatabase(): void {
  if (!database) {
    return;
  }

  try {
    // Run a checkpoint before closing to flush WAL contents
    database.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // ignore
  }

  database.close();
  database = null;
}

export function getDatabasePath(): string {
  const config = getConfig();
  return path.resolve(config.databasePath);
}

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
  createRequestsWorkspaceIndexSql,
  createUsersTableSql,
  createUsersEmailIndexSql,
  createWorkspacesTableSql,
  createWorkspacesUserIdIndexSql,
  createApiKeysTableSql,
  createApiKeysWorkspaceIdIndexSql,
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
  db.exec(createWorkspaceSettingsTableSql);
  
  // Requests table
  db.exec(createRequestsTableSql);
  db.exec(createRequestsTimestampIndexSql);
  db.exec(createRequestsWorkspaceTimestampIndexSql);
  db.exec(createRequestsRouteIndexSql);
  db.exec(createRequestsWorkspaceRouteTimestampIndexSql);
  db.exec(createRequestsWorkspaceModelTimestampIndexSql);
  db.exec(createRequestsWorkspaceIndexSql);
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

  database.close();
  database = null;
}
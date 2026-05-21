#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { getDatabasePath, getDatabase } from "../db/database";

async function main() {
  const backupDir = process.env.BACKUP_DIR ?? path.resolve(process.cwd(), "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dbPath = getDatabasePath();
  const filename = `tokenwatch-backup-${timestamp}.sqlite`;
  const dest = path.join(backupDir, filename);

  console.log("Starting backup to", dest);
  const db = getDatabase();
  try {
    // better-sqlite3 provides a backup API that safely copies a consistent snapshot
    await (db as any).backup(dest);
    console.log("Backup complete:", dest);
  } catch (err) {
    console.error("Backup failed:", err);
    process.exit(1);
  }
}

void main().catch((err) => { console.error(err); process.exit(1); });

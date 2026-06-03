#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getConfig } from "../config/env";

async function main() {
  const backupDir = process.env.BACKUP_DIR ?? path.resolve(process.cwd(), "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `tokenwatch-backup-${timestamp}.sql`);
  const databaseUrl = getConfig().databaseUrl;

  console.log("Starting PostgreSQL backup to", dest);
  await runPgDump(databaseUrl, dest);
  console.log("Backup complete:", dest);
}

function runPgDump(databaseUrl: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(dest);
    const child = spawn("pg_dump", [databaseUrl], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stdout.pipe(output);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      output.close();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `pg_dump exited with code ${code}`));
      }
    });
  });
}

void main().catch((err) => { console.error(err); process.exit(1); });

#!/usr/bin/env node
import { closeDatabase, initializeDatabase } from "../db/database";

async function main(): Promise<void> {
  await initializeDatabase();
  await closeDatabase();
  process.stdout.write("PostgreSQL schema initialized.\n");
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

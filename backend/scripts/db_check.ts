import path from "path";
import dotenv from "dotenv";

// load backend .env for consistency
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { getConfig } from "../src/config/env";
import { getDatabase } from "../src/db/database";

async function main() {
  const config = getConfig();
  console.log("Using DATABASE_URL:", config.databaseUrl);

  const db = getDatabase();
  try {
    const res = await db.query("SELECT current_database() as db, version() as version");
    console.log("current_database:", res.rows[0]);
  } catch (err) {
    console.error("DB check failed:", err);
    process.exit(1);
  }

  try {
    const ws = await db.prepare("SELECT id, monthly_budget FROM workspaces ORDER BY created_at DESC LIMIT 5").all();
    console.log("Recent workspaces:", ws);
  } catch (err) {
    console.error("Workspace read failed:", err);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

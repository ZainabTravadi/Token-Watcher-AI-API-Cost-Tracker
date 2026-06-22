import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { getDatabase } from "../src/db/database";

async function main() {
  const db = getDatabase();
  const workspaceId = process.argv[2] || "ws_test";

  const seededCount = await db.prepare("SELECT COUNT(*) as c FROM requests WHERE workspace_id = $1 AND metadata->>'seeded' = 'true'").get<{ c: string }>(workspaceId);
  const providerBreakdown = await db.prepare("SELECT provider, COUNT(*) as cnt, SUM(cost_usd) as spend FROM requests WHERE workspace_id = $1 AND metadata->>'seeded' = 'true' GROUP BY provider ORDER BY spend DESC").all(workspaceId);
  const modelBreakdown = await db.prepare("SELECT model, COUNT(*) as cnt, SUM(cost_usd) as spend FROM requests WHERE workspace_id = $1 AND metadata->>'seeded' = 'true' GROUP BY model ORDER BY spend DESC LIMIT 20").all(workspaceId);
  const totalSpend = await db.prepare("SELECT COALESCE(SUM(cost_usd),0) as s FROM requests WHERE workspace_id = $1 AND metadata->>'seeded' = 'true'").get<{ s: number }>(workspaceId);
  const budget = await db.prepare("SELECT monthly_budget FROM workspaces WHERE id = $1").get<{ monthly_budget: number }>(workspaceId);

  console.log(`Workspace: ${workspaceId}`);
  console.log(`Seeded rows: ${seededCount?.c ?? 0}`);
  console.log("Provider breakdown:", providerBreakdown);
  console.log("Top models:", modelBreakdown);
  console.log(`Total spend (seeded): $${(totalSpend?.s ?? 0).toFixed(4)}`);
  console.log(`Workspace budget: $${(budget?.monthly_budget ?? 0)}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

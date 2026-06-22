import path from "path";
import dotenv from "dotenv";
import { randomInt } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { getDatabase } from "../src/db/database";

async function main() {
  const workspaceId = process.argv[2] || "ws_test";
  const count = Number(process.argv[3] ?? 1000);
  const targetBudget = 1000;
  const targetSpend = 820; // desired spend

  const db = getDatabase();

  console.log(`Resetting seeded telemetry for workspace ${workspaceId} and inserting ${count} rows`);

  // Delete previous seeded rows for safety
  await db.prepare("DELETE FROM requests WHERE workspace_id = ? AND metadata->>'seeded' = 'true'").run(workspaceId);

  const insertSql = `INSERT INTO requests (workspace_id, timestamp, route, model, provider, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, error, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

  const providers = ["OpenAI", "Gemini", "Anthropic"];
  const routes = ["/api/chat", "/api/summarize", "/api/translate", "/api/embeddings", "/api/qa"];

  const rows: Array<any> = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let provider = "OpenAI";
    if (r < 0.8) provider = "OpenAI";
    else if (r < 0.95) provider = "Gemini";
    else provider = "Anthropic";

    let model: string;
    if (provider === "OpenAI") model = Math.random() < 0.6 ? "gpt-4o" : "gpt-4o-mini";
    else if (provider === "Gemini") model = "gemini-2.5-flash";
    else model = "claude-sonnet";

    const input_tokens = randomInt(20, 1200);
    const output_tokens = randomInt(10, 3000);
    const total_tokens = input_tokens + output_tokens;

    let cost_usd = total_tokens * 0.00004;
    if (provider === "OpenAI") cost_usd = total_tokens * 0.00009;
    if (provider === "Gemini") cost_usd = total_tokens * 0.000015;
    if (provider === "Anthropic") cost_usd = total_tokens * 0.00003;

    let latency_ms = 80 + randomInt(0, 400);
    // one latency spike
    if (i === Math.floor(count * 0.7)) latency_ms += 4000;

    let error: string | null = null;
    // one failure spike
    if (i === Math.floor(count * 0.4)) error = 'HTTP_500_INTERNAL';

    rows.push({
      workspace_id: workspaceId,
      timestamp: Date.now() - Math.floor((count - i) * 1000 * 60),
      route: routes[randomInt(0, routes.length)],
      model,
      provider,
      input_tokens,
      output_tokens,
      total_tokens,
      cost_usd,
      latency_ms,
      error,
      metadata: { seeded: true }
    });
  }

  // compute current spend and scale factor
  let totalSpend = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const scale = targetSpend / Math.max(1e-9, totalSpend);
  // apply scaling to cost_usd to hit targetSpend while keeping tokens intact
  for (const r of rows) {
    r.cost_usd = Number((r.cost_usd * scale).toFixed(6));
  }

  // insert in transaction
  await db.transaction(async () => {
    for (const r of rows) {
      await db.prepare(insertSql).run(
        r.workspace_id,
        r.timestamp,
        r.route,
        r.model,
        r.provider,
        r.input_tokens,
        r.output_tokens,
        r.total_tokens,
        r.cost_usd,
        r.latency_ms,
        r.error,
        JSON.stringify(r.metadata)
      );
    }
  });

  // report
  const seededCount = await db.prepare("SELECT COUNT(*) as c FROM requests WHERE workspace_id = $1 AND metadata->>'seeded' = 'true'").get(workspaceId);
  const totalSpendFinal = await db.prepare("SELECT COALESCE(SUM(cost_usd),0) as s FROM requests WHERE workspace_id = $1 AND metadata->>'seeded' = 'true'").get(workspaceId);

  console.log(`Inserted ${seededCount?.c ?? 0} telemetry rows for workspace ${workspaceId}`);
  console.log(`Estimated total spend: $${(totalSpendFinal?.s ?? 0).toFixed(2)}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

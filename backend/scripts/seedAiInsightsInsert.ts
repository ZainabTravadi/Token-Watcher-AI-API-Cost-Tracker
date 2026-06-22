import { randomInt } from "crypto";
import path from "path";
import dotenv from "dotenv";

// Usage: npx tsx backend/scripts/seedAiInsightsInsert.ts <workspaceId> [count]

async function main() {
  // Load backend .env explicitly so running from repo root uses same DATABASE_URL
  try {
    const envPath = path.resolve(__dirname, "..", ".env");
    dotenv.config({ path: envPath });
  } catch (err) {
    // ignore
  }

  const { getDatabase } = await import("../src/db/database");

  const argv = process.argv.slice(2);
  const workspaceId = argv[0] || "ws_test";
  const count = Number(argv[1] ?? 600);

  // Target scenario parameters
  const targetBudget = 1000; // $1000 monthly budget
  const targetSpend = 820; // $820 current spend (~82%)

  const providers = ["OpenAI", "Gemini", "Anthropic"];
  const routes = ["/api/chat", "/api/summarize", "/api/translate", "/api/embeddings", "/api/qa"];

  const db = getDatabase();
  const insertSql = `INSERT INTO requests (workspace_id, timestamp, route, model, provider, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, error, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`;

  let openaiSpend = 0;
  let totalSpend = 0;
  let inserted = 0;

  // Ensure workspace exists and set monthly budget to targetBudget
  const now = Date.now();
  const userId = "seed_user";
  const workspaceName = "Seed Workspace";
  const workspaceCheck = await db.prepare("SELECT id FROM workspaces WHERE id = $1").get(workspaceId);
  if (!workspaceCheck) {
    const userCheck = await db.prepare("SELECT id FROM users WHERE id = $1").get(userId);
    if (!userCheck) {
      await db.prepare("INSERT INTO users (id, email, password_hash, created_at, updated_at, last_logout_at) VALUES ($1,$2,$3,$4,$5,$6)").run(userId, "seed@example.com", "seed-hash", now, now, 0);
    }

    await db.prepare("INSERT INTO workspaces (id, user_id, name, monthly_budget, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)").run(workspaceId, userId, workspaceName, targetBudget, now, now);
  } else {
    await db.prepare("UPDATE workspaces SET monthly_budget = $1 WHERE id = $2").run(targetBudget, workspaceId);
  }

  // Create dataset
  await db.transaction(async () => {
    for (let i = 0; i < count; i++) {
      const ts = Date.now() - Math.floor((count - i) * (1000 * 60 * 60 * 2)); // more recent towards the end
      const r = Math.random();
      let provider = "OpenAI";
      if (r < 0.8) provider = "OpenAI";
      else if (r < 0.95) provider = "Gemini";
      else provider = "Anthropic";

      let model: string;
      if (provider === "OpenAI") model = Math.random() < 0.6 ? "gpt-4o" : "gpt-4o-mini";
      else if (provider === "Gemini") model = "gemini-2.5-flash";
      else model = "claude-sonnet";

      const route = routes[randomInt(0, routes.length)];
      const input_tokens = randomInt(20, 1200);
      const output_tokens = randomInt(10, 3000);
      const total_tokens = input_tokens + output_tokens;

      let cost_usd = total_tokens * 0.00004;
      if (provider === "OpenAI") cost_usd = total_tokens * 0.00009;
      if (provider === "Gemini") cost_usd = total_tokens * 0.000015;
      if (provider === "Anthropic") cost_usd = total_tokens * 0.00003;

      let latency_ms = 80 + randomInt(0, 400);
      if (route === "/api/qa" && Math.random() < 0.25) latency_ms += 2500; // latency spike

      let error: string | null = null;
      if (route === "/api/translate" && Math.random() < 0.12) error = "HTTP_500_INTERNAL"; // failure spike
      else if (Math.random() < 0.01) error = "HTTP_500_INTERNAL";

      const metadata = { seeded: true, trendIndex: i };

      await db.prepare(insertSql).run(
        workspaceId,
        ts,
        route,
        model,
        provider,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        latency_ms,
        error,
        JSON.stringify(metadata)
      );

      totalSpend += cost_usd;
      if (provider === "OpenAI") openaiSpend += cost_usd;
      inserted++;
    }

    // top up spend to targetSpend with high-cost OpenAI rows if needed
    while (totalSpend < targetSpend) {
      const ts = Date.now() - randomInt(0, 1000 * 60 * 60 * 24 * 3);
      const provider = "OpenAI";
      const model = "gpt-4o";
      const route = "/api/chat";
      const input_tokens = randomInt(500, 4000);
      const output_tokens = randomInt(200, 5000);
      const total_tokens = input_tokens + output_tokens;
      const cost_usd = total_tokens * 0.00009;
      const latency_ms = 200 + randomInt(0, 800);
      const error = null;
      const metadata = { seeded: true, supplemental: true };

      await db.prepare(insertSql).run(
        workspaceId,
        ts,
        route,
        model,
        provider,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        latency_ms,
        error,
        JSON.stringify(metadata)
      );

      totalSpend += cost_usd;
      openaiSpend += cost_usd;
      inserted++;
    }
  });

  const openaiPct = (openaiSpend / Math.max(1e-9, totalSpend)) * 100;
  console.log(`Inserted ${inserted} telemetry rows for workspace ${workspaceId}`);
  console.log(`Estimated total spend: $${totalSpend.toFixed(2)} (OpenAI share ~${openaiPct.toFixed(1)}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

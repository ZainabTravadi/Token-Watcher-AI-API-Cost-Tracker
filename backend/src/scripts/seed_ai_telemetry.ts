import { getDatabase, initializeDatabase, closeDatabase } from "../db/database";
import { generateApiKey, generateId, hashApiKey } from "../utils/auth";

interface WorkspaceSeedConfig {
  name: string;
  ownerName: string;
  ownerEmail: string;
  budget: number;
  alertThreshold: number;
  role: string;
}

interface InsertedWorkspace {
  id: string;
  userId: string;
  apiKey: string;
}

const TOTAL_REQUESTS = 100_000;
const REQUEST_BATCH_SIZE = 1_000;
const REQUEST_WINDOW_DAYS = 90;

const workspaceConfigs: WorkspaceSeedConfig[] = [
  { name: "Startup", ownerName: "Developer", ownerEmail: "developer@tokenwatch.ai", budget: 18000, alertThreshold: 14000, role: "engineering" },
  { name: "Enterprise", ownerName: "AI Engineer", ownerEmail: "ai.engineer@tokenwatch.ai", budget: 26000, alertThreshold: 21000, role: "platform" },
  { name: "Research Lab", ownerName: "Backend Engineer", ownerEmail: "backend.engineer@tokenwatch.ai", budget: 32000, alertThreshold: 25000, role: "research" },
  { name: "Agency", ownerName: "Data Scientist", ownerEmail: "data.scientist@tokenwatch.ai", budget: 22000, alertThreshold: 18000, role: "analytics" },
  { name: "Internal Dev", ownerName: "Product Manager", ownerEmail: "product.manager@tokenwatch.ai", budget: 15000, alertThreshold: 12000, role: "product" }
];

const modelProfiles = [
  { model: "GPT-4o", provider: "OpenAI", weight: 35, baseLatency: 780, inputCost: 0.005, outputCost: 0.015 },
  { model: "GPT-4.1", provider: "OpenAI", weight: 18, baseLatency: 840, inputCost: 0.006, outputCost: 0.018 },
  { model: "GPT-4.1 Mini", provider: "OpenAI", weight: 10, baseLatency: 480, inputCost: 0.0012, outputCost: 0.0045 },
  { model: "Gemini 2.5 Flash", provider: "Google Gemini", weight: 20, baseLatency: 640, inputCost: 0.00035, outputCost: 0.0014 },
  { model: "Gemini 2.5 Pro", provider: "Google Gemini", weight: 10, baseLatency: 900, inputCost: 0.0018, outputCost: 0.0072 },
  { model: "Claude Sonnet", provider: "Anthropic", weight: 12, baseLatency: 920, inputCost: 0.003, outputCost: 0.015 },
  { model: "Claude Opus", provider: "Anthropic", weight: 5, baseLatency: 1180, inputCost: 0.015, outputCost: 0.075 },
  { model: "DeepSeek Chat", provider: "DeepSeek", weight: 7, baseLatency: 560, inputCost: 0.0002, outputCost: 0.0008 },
  { model: "Mistral Large", provider: "Mistral", weight: 3, baseLatency: 720, inputCost: 0.002, outputCost: 0.008 }
];

const routeProfiles = [
  { route: "/chat", weight: 28 },
  { route: "/summarize", weight: 16 },
  { route: "/translate", weight: 10 },
  { route: "/embeddings", weight: 12 },
  { route: "/image", weight: 8 },
  { route: "/rag/query", weight: 11 },
  { route: "/code-review", weight: 7 },
  { route: "/document-analysis", weight: 5 },
  { route: "/customer-support", weight: 3 }
];

const statusCodeWeights = [
  { value: 200, weight: 82 },
  { value: 400, weight: 4 },
  { value: 401, weight: 2 },
  { value: 403, weight: 2 },
  { value: 404, weight: 2 },
  { value: 408, weight: 2 },
  { value: 429, weight: 3 },
  { value: 500, weight: 2 },
  { value: 503, weight: 1 }
];

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty weighted list");
  }

  const total = items.reduce((acc, item) => acc + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1] as T;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateTimestamp(index: number): number {
  const windowMs = REQUEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const dayBias = Math.pow(Math.random(), 1.15);
  const daysAgo = Math.floor(dayBias * REQUEST_WINDOW_DAYS);
  const hoursAgo = randomInt(0, 23);
  const minutesAgo = randomInt(0, 59);
  const base = Date.now() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000 - minutesAgo * 60 * 1000;
  const hour = getNaturalHour(index);
  const minute = randomInt(0, 59);
  const second = randomInt(0, 59);
  const date = new Date(base);
  date.setHours(hour, minute, second, 0);
  return date.getTime();
}

function getNaturalHour(index: number): number {
  const hour = Math.floor(index / 120) % 24;
  const surge = Math.random() < 0.08 ? randomInt(0, 3) : 0;
  const weightedIndex = Math.min(23, Math.max(0, hour + surge));
  return Math.min(23, Math.max(0, Math.round(weightedIndex + (Math.random() < 0.12 ? randomInt(-1, 1) : 0))));
}

function buildMetadata(statusCode: number, route: string, model: string, provider: string, latencyMs: number, totalTokens: number, costUsd: number): string {
  const cacheHit = Math.random() < 0.18;
  const streaming = Math.random() < 0.31;
  const temperature = Number(randomFloat(0.1, 0.9).toFixed(2));
  const topP = Number(randomFloat(0.7, 1).toFixed(2));
  const maxTokens = randomInt(512, 4096);
  const burst = Math.random() < 0.04;

  return JSON.stringify({
    status_code: statusCode,
    route,
    model,
    provider,
    cache_hit: cacheHit,
    streaming,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    environment: statusCode >= 500 ? "production" : "production",
    anomaly: burst ? "burst" : null,
    total_tokens: totalTokens,
    cost_usd: Number(costUsd.toFixed(6)),
    latency_ms: latencyMs
  });
}

function buildRequestRecord(workspaceId: string, index: number): Record<string, unknown> {
  const routeProfile = pickWeighted(routeProfiles);
  const modelProfile = pickWeighted(modelProfiles);
  const timestamp = generateTimestamp(index);
  const date = new Date(timestamp);
  const hourFactor = Math.max(0.6, Math.min(1.8, 0.9 + Math.sin((date.getHours() / 24) * Math.PI * 2) * 0.35));
  const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.78 : 1;
  const burstFactor = Math.random() < 0.07 ? randomFloat(1.4, 3.2) : 1;
  const baseInput = randomInt(180, 2600);
  const baseOutput = randomInt(80, 1400);
  const inputTokens = Math.round(baseInput * hourFactor * weekendFactor * burstFactor * (routeProfile.route === "/embeddings" ? 0.45 : routeProfile.route === "/image" ? 0.65 : 1));
  const outputTokens = Math.round(baseOutput * hourFactor * weekendFactor * burstFactor * (routeProfile.route === "/image" ? 1.4 : 1));
  const totalTokens = inputTokens + outputTokens;
  const latency = Math.min(12000, Math.round(modelProfile.baseLatency * burstFactor + totalTokens / 4 + randomInt(-70, 130)));
  const costUsd = Number(((inputTokens / 1000) * modelProfile.inputCost + (outputTokens / 1000) * modelProfile.outputCost).toFixed(6));
  const statusCode = pickWeighted(statusCodeWeights).value;

  const error = statusCode >= 400 ? `HTTP_${statusCode}_${statusCode === 429 ? "RATE_LIMIT" : statusCode >= 500 ? "UPSTREAM_ERROR" : "CLIENT_ERROR"}` : null;
  const metadata = buildMetadata(statusCode, routeProfile.route, modelProfile.model, modelProfile.provider, latency, totalTokens, costUsd);

  return {
    workspace_id: workspaceId,
    timestamp,
    route: routeProfile.route,
    model: modelProfile.model,
    provider: modelProfile.provider,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    latency_ms: latency,
    error,
    metadata
  };
}

async function resetExistingSeedData(db: ReturnType<typeof getDatabase>): Promise<void> {
  const workspaceNames = workspaceConfigs.map((item) => item.name);
  const ownerEmails = workspaceConfigs.map((item) => item.ownerEmail);

  const workspaceRows = await db.prepare(`SELECT id FROM workspaces WHERE name IN (${workspaceNames.map(() => "?").join(", ")});`).all<{ id: string }>(...workspaceNames);
  const workspaceIds = workspaceRows.map((row) => row.id);

  if (workspaceIds.length > 0) {
    const requestDeleteSql = `DELETE FROM requests WHERE workspace_id IN (${workspaceIds.map(() => "?").join(", ")});`;
    await db.prepare(requestDeleteSql).run(...workspaceIds);
    const keyDeleteSql = `DELETE FROM api_keys WHERE workspace_id IN (${workspaceIds.map(() => "?").join(", ")});`;
    await db.prepare(keyDeleteSql).run(...workspaceIds);
    const settingDeleteSql = `DELETE FROM workspace_settings WHERE workspace_id IN (${workspaceIds.map(() => "?").join(", ")});`;
    await db.prepare(settingDeleteSql).run(...workspaceIds);
    const workspaceDeleteSql = `DELETE FROM workspaces WHERE id IN (${workspaceIds.map(() => "?").join(", ")});`;
    await db.prepare(workspaceDeleteSql).run(...workspaceIds);
  }

  await db.prepare(`DELETE FROM users WHERE email IN (${ownerEmails.map(() => "?").join(", ")});`).run(...ownerEmails);
}

async function seedUsersAndWorkspaces(db: ReturnType<typeof getDatabase>): Promise<InsertedWorkspace[]> {
  const seededWorkspaces: InsertedWorkspace[] = [];
  const now = Date.now();

  for (const config of workspaceConfigs) {
    const userId = generateId("user");
    const workspaceId = generateId("ws");
    const settingsId = generateId("wss");
    const apiKey = generateApiKey();

    await db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, config.ownerEmail, hashApiKey(`seed-${config.ownerEmail}`), now, now);

    await db.prepare(
      "INSERT INTO workspaces (id, user_id, name, monthly_budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(workspaceId, userId, config.name, config.budget, now, now);

    await db.prepare(
      "INSERT INTO workspace_settings (id, workspace_id, alert_on_high_cost, alert_on_errors, alert_cost_threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(settingsId, workspaceId, true, true, config.alertThreshold, now, now);

    await db.prepare(
      "INSERT INTO api_keys (id, workspace_id, key_hash, created_at) VALUES (?, ?, ?, ?)"
    ).run(generateId("api_key"), workspaceId, hashApiKey(apiKey), now);

    seededWorkspaces.push({ id: workspaceId, userId, apiKey });
  }

  return seededWorkspaces;
}

async function seedTelemetry(db: ReturnType<typeof getDatabase>, workspaces: InsertedWorkspace[]): Promise<number> {
  let inserted = 0;
  const startedAt = Date.now();

  for (let offset = 0; offset < TOTAL_REQUESTS; offset += REQUEST_BATCH_SIZE) {
    const batchSize = Math.min(REQUEST_BATCH_SIZE, TOTAL_REQUESTS - offset);
    const batch: Array<Record<string, unknown>> = [];

    if (workspaces.length === 0) {
      throw new Error("No workspaces were created for telemetry seeding");
    }

    for (let item = 0; item < batchSize; item += 1) {
      const workspace = workspaces[(offset + item) % workspaces.length];
      if (!workspace) {
        throw new Error("Unable to resolve workspace for telemetry seeding");
      }
      batch.push(buildRequestRecord(workspace.id, offset + item));
    }

    const values: unknown[] = [];
    const rowPlaceholders = batch.map((record) => {
      const rowValues = [
        record.workspace_id,
        record.timestamp,
        record.route,
        record.model,
        record.provider,
        record.input_tokens,
        record.output_tokens,
        record.total_tokens,
        record.cost_usd,
        record.latency_ms,
        record.error,
        record.metadata
      ];
      values.push(...rowValues);
      return `(${rowValues.map((_, index) => `?`).join(", ")})`;
    });

    const insertSql = `
      INSERT INTO requests (
        workspace_id,
        timestamp,
        route,
        model,
        provider,
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        latency_ms,
        error,
        metadata
      ) VALUES ${rowPlaceholders.join(", ")}
    `;

    await db.transaction(async () => {
      await db.prepare(insertSql).run(...values);
    });

    inserted += batchSize;
    if (inserted % 10_000 === 0 || inserted === TOTAL_REQUESTS) {
      const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      process.stdout.write(`[seed] inserted ${inserted.toLocaleString()}/${TOTAL_REQUESTS.toLocaleString()} rows in ${durationSeconds}s\n`);
    }
  }

  return inserted;
}

async function main(): Promise<void> {
  await initializeDatabase();
  const db = getDatabase();

  const startedAt = Date.now();
  await resetExistingSeedData(db);
  const workspaces = await seedUsersAndWorkspaces(db);
  const inserted = await seedTelemetry(db, workspaces);
  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  const userCount = await db.prepare("SELECT COUNT(*) AS count FROM users;").get<{ count: string | number }>();
  const workspaceCount = await db.prepare("SELECT COUNT(*) AS count FROM workspaces;").get<{ count: string | number }>();
  const requestCount = await db.prepare("SELECT COUNT(*) AS count FROM requests;").get<{ count: string | number }>();
  const spendRow = await db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total_cost FROM requests;").get<{ total_cost: string | number }>();
  const errorRow = await db.prepare("SELECT COUNT(*) AS error_count FROM requests WHERE error IS NOT NULL;").get<{ error_count: string | number }>();

  process.stdout.write(`\n[seed] completed in ${durationSeconds}s\n`);
  process.stdout.write(`[seed] users: ${Number(userCount?.count ?? 0).toLocaleString()}\n`);
  process.stdout.write(`[seed] workspaces: ${Number(workspaceCount?.count ?? 0).toLocaleString()}\n`);
  process.stdout.write(`[seed] requests: ${Number(requestCount?.count ?? 0).toLocaleString()}\n`);
  process.stdout.write(`[seed] total spend: $${Number(spendRow?.total_cost ?? 0).toFixed(2)}\n`);
  process.stdout.write(`[seed] error rate: ${((Number(errorRow?.error_count ?? 0) / inserted) * 100).toFixed(2)}%\n`);

  await closeDatabase();
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

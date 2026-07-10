import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";

async function listen(server, port) {
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
}

async function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

async function waitFor(check, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for expected condition");
}

async function stopChild(child, signal = "SIGTERM", timeoutMs = 5000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = once(child, "exit");
  child.kill(signal);

  await Promise.race([
    exited,
    new Promise((resolve) => {
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
        resolve();
      }, timeoutMs);
    })
  ]);
}

const backendCalls = [];
const telegramMessages = [];

const tokenWatcherMock = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3301");
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const body = rawBody ? JSON.parse(rawBody) : {};

  const authHeader = request.headers.authorization;
  const record = { path: `${url.pathname}${url.search}`, method: request.method, authorization: authHeader, body };
  backendCalls.push(record);

  if (authHeader !== "Bearer tw_oc_openclaw_mock_key") {
    response.statusCode = 401;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "Invalid API key" }));
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json");

  switch (url.pathname) {
    case "/api/me":
      response.end(JSON.stringify({
        identity: {
          type: "api_key",
          key: {
            id: "key_openclaw_mock",
            type: "OPENCLAW",
            label: "Mock OpenClaw key",
            permissions: ["workspace:read", "analytics:read", "requests:read", "reports:read", "recommendations:read", "forecast:read", "copilot:use"],
            expires_at: null
          },
          workspace: { id: "ws_mock", name: "Mock Workspace" },
          organization: { id: "ws_mock", name: "Mock Workspace" },
          owner: { id: "user_mock", email: "mock@example.com" }
        }
      }));
      return;
    case "/api/analytics/overview":
      response.end(JSON.stringify({
        data: {
          spendToday: 42.37,
          requestsToday: 318,
          avgCostPerRequest: 0.1332,
          budget: 5000,
          errorRate: 0.021,
          errors429: 3,
          errors500: 4
        }
      }));
      return;
    case "/api/analytics/models":
      response.end(JSON.stringify({
        data: [
          { provider: "gemini", model: "gemini-1.5-pro", cost_usd: 21.2, requests: 120 },
          { provider: "gemini", model: "gemini-1.5-flash", cost_usd: 10.4, requests: 140 },
          { provider: "gemini", model: "gemini-2.0-flash", cost_usd: 6.1, requests: 58 }
        ]
      }));
      return;
    case "/api/analytics/endpoints":
      response.end(JSON.stringify({
        data: [
          { route: "/api/chat", cost_usd: 19.7, requests: 110 },
          { route: "/api/analyze", cost_usd: 12.8, requests: 94 },
          { route: "/api/report", cost_usd: 7.6, requests: 41 }
        ]
      }));
      return;
    case "/api/analytics/recent":
      response.end(JSON.stringify({
        data: [
          { status: "200", cost: 0.52, endpoint: "/api/chat", model: "gemini-1.5-pro" },
          { status: "200", cost: 0.18, endpoint: "/api/chat", model: "gemini-1.5-flash" },
          { status: "429", cost: 0.0, endpoint: "/api/report", model: "gemini-1.5-pro" }
        ]
      }));
      return;
    case "/api/forecast":
      response.end(JSON.stringify({
        data: {
          predictedSpend: { daily: 44.2, weekly: 309.4, monthly: 1326.0 },
          predictedRequests: { daily: 330, weekly: 2310, monthly: 9900 },
          predictedBudgetDate: null,
          confidence: 81,
          historicalWindow: { samples: 7 },
          expectedCostTrend: "flat"
        }
      }));
      return;
    case "/api/forecast/budget":
      response.end(JSON.stringify({
        data: {
          predictedSpend: { daily: 44.2, weekly: 309.4, monthly: 1326.0 },
          predictedBudgetDate: "2026-09-03T00:00:00.000Z",
          confidence: 81,
          historicalWindow: { samples: 7 }
        }
      }));
      return;
    case "/api/requests":
      response.end(JSON.stringify({
        data: {
          data: [
            { route: "/api/chat", model: "gemini-1.5-pro", cost_usd: 0.52, error: null },
            { route: "/api/chat", model: "gemini-1.5-flash", cost_usd: 0.18, error: null },
            { route: "/api/report", model: "gemini-1.5-pro", cost_usd: 0.0, error: "HTTP_429_LIMIT" }
          ],
          page: 1,
          limit: 5,
          total: 3,
          hasMore: false,
          nextCursor: null
        }
      }));
      return;
    case "/api/intelligence/recommendations":
      response.end(JSON.stringify({
        data: [
          { title: "Switch eligible traffic to a cheaper model", priority: "high", estimatedSavings: 182.44 },
          { title: "Reduce prompt tokens", priority: "medium", estimatedSavings: 96.12 },
          { title: "Enable prompt caching", priority: "medium", estimatedSavings: 54.33 }
        ]
      }));
      return;
    case "/api/reports/executive":
      response.end(JSON.stringify({
        data: {
          type: "executive",
          summary: "Spend is controlled, but one high-cost model still dominates the workspace.",
          keyMetrics: [
            { name: "Spend Today", value: 42.37, unit: "USD" },
            { name: "Requests Today", value: 318 },
            { name: "Efficiency Score", value: 81 }
          ],
          actionItems: ["Move low-risk traffic to flash models", "Trim repeated prompt context", "Review retry-heavy endpoints"]
        }
      }));
      return;
    case "/api/reports/infrastructure":
      response.end(JSON.stringify({
        data: {
          type: "infrastructure",
          summary: "Gemini usage is concentrated in three endpoints with acceptable latency overall.",
          keyMetrics: [
            { name: "Spend Today", value: 42.37, unit: "USD" },
            { name: "Requests Today", value: 318 },
            { name: "Average Cost Per Request", value: 0.1332, unit: "USD" }
          ],
          actionItems: ["Rebalance high-cost traffic", "Watch 429 spikes on /api/report", "Review top endpoint latency"]
        }
      }));
      return;
    case "/api/reports/weekly":
      response.end(JSON.stringify({
        data: {
          type: "weekly",
          summary: "Weekly spend remains stable with a small increase in request volume.",
          keyMetrics: [{ name: "Spend Today", value: 42.37, unit: "USD" }],
          actionItems: ["Monitor daily trend"]
        }
      }));
      return;
    case "/api/reports/monthly":
      response.end(JSON.stringify({
        data: {
          type: "monthly",
          summary: "Monthly spend is below budget and trending flat.",
          keyMetrics: [{ name: "Monthly Spend Forecast", value: 1326, unit: "USD" }],
          actionItems: ["Keep current budget controls"]
        }
      }));
      return;
    case "/api/copilot/chat":
      response.end(JSON.stringify({
        data: {
          answer: typeof body.message === "string" && body.message.toLowerCase().includes("infrastructure")
            ? "Infrastructure audit: spend is concentrated in `/api/chat` and `/api/analyze`, with the main operational risk coming from intermittent 429s on `/api/report`."
            : "Costs increased because higher-cost model traffic shifted into `/api/chat` while retry pressure also added extra failed requests.",
          confidence: 84,
          toolsUsed: ["getAnalyticsSnapshot", "getRecommendations", "getAnomalies"]
        }
      }));
      return;
    default:
      response.statusCode = 404;
      response.end("not found");
  }
});

const telegramMock = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3302");
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const body = rawBody ? JSON.parse(rawBody) : {};

  if (request.method === "POST" && url.pathname === "/botphase3b-bot/sendMessage") {
    telegramMessages.push(body);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true, result: { message_id: telegramMessages.length } }));
    return;
  }

  response.statusCode = 404;
  response.end("not found");
});

await listen(tokenWatcherMock, 3301);
await listen(telegramMock, 3302);

const child = spawn("node", ["dist/main.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    OPENCLAW_PORT: "3303",
    OPENCLAW_HOST: "127.0.0.1",
    OPENCLAW_TELEGRAM_BOT_TOKEN: "phase3b-bot",
    OPENCLAW_TELEGRAM_API_URL: "http://127.0.0.1:3302",
    TOKENWATCHER_API_URL: "http://127.0.0.1:3301",
    TOKENWATCHER_API_KEY: "tw_oc_openclaw_mock_key",
    OPENCLAW_LOG_LEVEL: "error"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

await waitFor(async () => {
  try {
    const response = await fetch("http://127.0.0.1:3303/health");
    return response.ok;
  } catch {
    return false;
  }
});

const scenarios = [
  {
    text: "What's my spend today?",
    expectedCallPrefix: "/api/analytics/overview",
    expectedMessageIncludes: "Today's Spend"
  },
  {
    text: "Budget status",
    expectedCallPrefix: "/api/forecast/budget",
    expectedMessageIncludes: "Budget Status"
  },
  {
    text: "Forecast this month",
    expectedCallPrefix: "/api/forecast",
    expectedMessageIncludes: "Forecast"
  },
  {
    text: "Show recent requests",
    expectedCallPrefix: "/api/analytics/recent",
    expectedMessageIncludes: "Recent Requests"
  },
  {
    text: "Recommendations",
    expectedCallPrefix: "/api/intelligence/recommendations",
    expectedMessageIncludes: "Recommendations"
  },
  {
    text: "Executive report",
    expectedCallPrefix: "/api/reports/executive",
    expectedMessageIncludes: "Executive Report"
  },
  {
    text: "Why did costs increase?",
    expectedCallPrefix: "/api/copilot/chat",
    expectedMessageIncludes: "Copilot"
  },
  {
    text: "Give me a complete infrastructure audit",
    expectedCallPrefix: "/api/copilot/chat",
    expectedMessageIncludes: "Infrastructure audit"
  }
];

for (const [index, scenario] of scenarios.entries()) {
  const previousCalls = backendCalls.length;
  const previousMessages = telegramMessages.length;
  const webhookResponse = await postJson("http://127.0.0.1:3303/telegram/webhook", {
    update_id: index + 1,
    message: {
      message_id: index + 1,
      text: scenario.text,
      chat: { id: 123456, type: "private" }
    }
  });

  if (!webhookResponse.ok) {
    const body = await webhookResponse.text();
    throw new Error(`Webhook request failed for "${scenario.text}" with ${webhookResponse.status}: ${body}`);
  }

  await waitFor(() => telegramMessages.length > previousMessages);
  const newCalls = backendCalls.slice(previousCalls);
  const expectedCall = newCalls.find((call) => String(call.path).startsWith(scenario.expectedCallPrefix));
  if (!expectedCall) {
    throw new Error(`Expected backend call ${scenario.expectedCallPrefix} for "${scenario.text}" but saw ${JSON.stringify(newCalls)}`);
  }

  if (expectedCall.authorization !== "Bearer tw_oc_openclaw_mock_key") {
    throw new Error(`Expected OpenClaw API key bearer token, received: ${expectedCall.authorization}`);
  }

  const telegramMessage = telegramMessages.at(-1);
  if (!String(telegramMessage?.text || "").includes(scenario.expectedMessageIncludes)) {
    throw new Error(`Unexpected Telegram payload for "${scenario.text}": ${JSON.stringify(telegramMessage)}`);
  }
}

await stopChild(child);
await Promise.all([
  new Promise((resolve) => tokenWatcherMock.close(resolve)),
  new Promise((resolve) => telegramMock.close(resolve))
]);

if (stderr.trim()) {
  throw new Error(`OpenClaw emitted stderr during verification:\n${stderr}`);
}

process.stdout.write("Phase 3B verification passed.\n");


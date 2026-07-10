import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(process.cwd(), "..");
const backendRoot = path.join(repoRoot, "backend");
const sdkRoot = path.join(repoRoot, "sdk");
const openClawRoot = process.cwd();
const sdkEntryUrl = pathToFileURL(path.join(sdkRoot, "dist", "esm", "index.js")).href;

function randomId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

async function listen(server, port) {
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
}

async function waitFor(check, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for expected condition");
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

async function getJson(url, headers = {}) {
  return fetch(url, {
    method: "GET",
    headers
  });
}

function startChild(command, args, options) {
  const child = spawn(command, args, options);
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return {
    child,
    getStdout: () => stdout,
    getStderr: () => stderr
  };
}

function spawnNpm(args, options) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`], options);
  }
  return spawn("npm", args, options);
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

const telegramMessages = [];
const telegramServer = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3302");
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const body = rawBody ? JSON.parse(rawBody) : {};

  if (request.method === "POST" && url.pathname.startsWith("/bot") && url.pathname.endsWith("/sendMessage")) {
    telegramMessages.push(body);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true, result: { message_id: telegramMessages.length } }));
    return;
  }

  response.statusCode = 404;
  response.end("not found");
});

await listen(telegramServer, 3302);

const backend = startChild("node", ["dist/main.js"], {
  cwd: backendRoot,
  env: {
    ...process.env,
    PORT: "3001",
    ENABLE_SIMULATORS: "false",
    TOKENWATCH_REQUIRE_SIGNED_INGEST: "true",
    TOKENWATCH_INGEST_SIGNATURE_TOLERANCE_MS: "300000"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitFor(async () => {
    try {
      const response = await getJson("http://127.0.0.1:3001/api/health");
      return response.ok;
    } catch {
      return false;
    }
  }, 45000);

  const email = `${randomId("openclaw")}@example.com`;
  const password = `Pass-${randomId("pw")}-12345`;
  const signupResponse = await postJson("http://127.0.0.1:3001/api/auth/signup", { email, password });
  if (!signupResponse.ok) {
    throw new Error(`Signup failed: ${signupResponse.status} ${await signupResponse.text()}`);
  }
  const signupBody = await signupResponse.json();
  const authCookie = signupResponse.headers.get("set-cookie")?.split(";")[0];
  const workspaceId = signupBody.workspace?.id;
  const apiKey = signupBody.workspace?.apiKey?.value;
  if (!workspaceId || !apiKey || !authCookie) {
    throw new Error(`Signup did not return workspace/api key: ${JSON.stringify(signupBody)}`);
  }

  const openclawKeyResponse = await postJson(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/api-keys`,
    { label: "Live verification OpenClaw", type: "OPENCLAW" },
    { Cookie: authCookie }
  );
  if (!openclawKeyResponse.ok) {
    throw new Error(`OpenClaw key creation failed: ${openclawKeyResponse.status} ${await openclawKeyResponse.text()}`);
  }
  const openclawKeyBody = await openclawKeyResponse.json();
  const openclawApiKey = openclawKeyBody.apiKey;
  const openclawKeyId = openclawKeyBody.apiKeyMeta?.id;
  if (!openclawApiKey) {
    throw new Error(`OpenClaw key creation did not return secret: ${JSON.stringify(openclawKeyBody)}`);
  }

  const sdkPermissionResponse = await getJson("http://127.0.0.1:3001/api/analytics/overview", {
    Authorization: `Bearer ${apiKey}`
  });
  if (sdkPermissionResponse.status !== 403) {
    throw new Error(`SDK key should not access analytics; received ${sdkPermissionResponse.status}: ${await sdkPermissionResponse.text()}`);
  }

  const expiringKeyResponse = await postJson(
    `http://127.0.0.1:3001/api/workspaces/${workspaceId}/api-keys`,
    { label: "Expired verification key", type: "OPENCLAW", expires_at: Date.now() + 2000 },
    { Cookie: authCookie }
  );
  if (!expiringKeyResponse.ok) {
    throw new Error(`Expiring key creation failed: ${expiringKeyResponse.status} ${await expiringKeyResponse.text()}`);
  }
  const expiringKey = (await expiringKeyResponse.json()).apiKey;
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const expiredResponse = await getJson("http://127.0.0.1:3001/api/analytics/overview", {
    Authorization: `Bearer ${expiringKey}`
  });
  if (expiredResponse.status !== 401) {
    throw new Error(`Expired OpenClaw key should fail; received ${expiredResponse.status}: ${await expiredResponse.text()}`);
  }

  await new Promise((resolve, reject) => {
    const run = spawnNpm(["run", "build"], { cwd: sdkRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    run.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    run.on("exit", (code) => code === 0 ? resolve(true) : reject(new Error(`SDK build failed: ${stderr}`)));
  });

  const seedScript = `
    import { TokenWatch } from ${JSON.stringify(sdkEntryUrl)};
    TokenWatch.init({
      apiUrl: "http://127.0.0.1:3001",
      apiKey: ${JSON.stringify(apiKey)},
      endpoint: "/ingest"
    });
    const base = Date.now();
    const events = [
      { route: "/api/chat", provider: "gemini", model: "gemini-1.5-pro", cost_usd: 1.9, latency_ms: 820, input_tokens: 1200, output_tokens: 440, total_tokens: 1640, timestamp: base - 1000 },
      { route: "/api/chat", provider: "gemini", model: "gemini-1.5-pro", cost_usd: 2.4, latency_ms: 910, input_tokens: 1400, output_tokens: 480, total_tokens: 1880, timestamp: base - 2000 },
      { route: "/api/analyze", provider: "gemini", model: "gemini-1.5-flash", cost_usd: 0.7, latency_ms: 420, input_tokens: 680, output_tokens: 220, total_tokens: 900, timestamp: base - 3000 },
      { route: "/api/report", provider: "gemini", model: "gemini-1.5-pro", cost_usd: 0.0, latency_ms: 1200, input_tokens: 1100, output_tokens: 0, total_tokens: 1100, timestamp: base - 4000, error: "HTTP_429_LIMIT" },
      { route: "/api/audit", provider: "gemini", model: "gemini-2.0-flash", cost_usd: 0.9, latency_ms: 610, input_tokens: 730, output_tokens: 260, total_tokens: 990, timestamp: base - 5000 },
      { route: "/api/chat", provider: "gemini", model: "gemini-1.5-pro", cost_usd: 3.1, latency_ms: 980, input_tokens: 1650, output_tokens: 540, total_tokens: 2190, timestamp: base - 6000, error: "HTTP_500_UPSTREAM" }
    ];
    const pending = events.map((event) => TokenWatch.track("llm.request.completed", event));
    await TokenWatch.flush();
    await Promise.all(pending);
  `;

  const tempDir = path.join(repoRoot, "tmp", "openclaw-live");
  const seedPath = path.join(tempDir, `seed-${Date.now()}.mjs`);
  await mkdir(tempDir, { recursive: true });
  await writeFile(seedPath, seedScript, "utf8");

  try {
    await new Promise((resolve, reject) => {
      const run = spawn("node", [seedPath], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      run.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      run.on("exit", (code) => code === 0 ? resolve(true) : reject(new Error(`SDK seed failed: ${stderr}`)));
    });
  } finally {
    await rm(seedPath, { force: true });
  }

  const openclaw = startChild("node", ["dist/main.js"], {
    cwd: openClawRoot,
    env: {
      ...process.env,
      OPENCLAW_PORT: "3303",
      OPENCLAW_HOST: "127.0.0.1",
      OPENCLAW_TELEGRAM_BOT_TOKEN: "live-phase-bot",
      OPENCLAW_TELEGRAM_API_URL: "http://127.0.0.1:3302",
      TOKENWATCHER_API_URL: "http://127.0.0.1:3001",
      TOKENWATCHER_API_KEY: openclawApiKey,
      TOKENWATCHER_TIMEOUT_MS: "60000",
      OPENCLAW_LOG_LEVEL: "error"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitFor(async () => {
      try {
        const response = await getJson("http://127.0.0.1:3303/health");
        return response.ok;
      } catch {
        return false;
      }
    }, 15000);

    const scenarios = [
      { text: "Today's spend", expected: "Today's Spend" },
      { text: "Budget status", expected: "Budget Status" },
      { text: "Forecast", expected: "Forecast" },
      { text: "Recent requests", expected: "Recent Requests" },
      { text: "Recommendations", expected: "Recommendations" },
      { text: "Executive report", expected: "Executive Report" },
      { text: "Weekly report", expected: "Weekly Report" },
      { text: "Infrastructure report", expected: "Infrastructure Report" },
      { text: "Why did costs spike?", expected: "Copilot" },
      { text: "Give me a complete infrastructure audit", expected: "Copilot" }
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const previousCount = telegramMessages.length;
      const response = await postJson("http://127.0.0.1:3303/telegram/webhook", {
        update_id: index + 1,
        message: {
          message_id: index + 1,
          text: scenario.text,
          chat: { id: 777001, type: "private" }
        }
      });
      if (!response.ok) {
        throw new Error(`Webhook failed for "${scenario.text}": ${response.status} ${await response.text()}`);
      }
      await waitFor(() => telegramMessages.length > previousCount);
      const telegramMessage = telegramMessages.at(-1);
      if (!String(telegramMessage?.text || "").includes(scenario.expected)) {
        throw new Error(`Unexpected Telegram message for "${scenario.text}": ${JSON.stringify(telegramMessage)}`);
      }
    }

    if (!openclawKeyId) {
      throw new Error(`OpenClaw key metadata did not include an id: ${JSON.stringify(openclawKeyBody)}`);
    }
    const revokeResponse = await postJson(
      `http://127.0.0.1:3001/api/workspaces/${workspaceId}/api-keys/${openclawKeyId}/revoke`,
      {},
      { Cookie: authCookie }
    );
    if (!revokeResponse.ok) {
      throw new Error(`OpenClaw key revoke failed: ${revokeResponse.status} ${await revokeResponse.text()}`);
    }
    const revokedResponse = await getJson("http://127.0.0.1:3001/api/analytics/overview", {
      Authorization: `Bearer ${openclawApiKey}`
    });
    if (revokedResponse.status !== 401) {
      throw new Error(`Revoked OpenClaw key should fail; received ${revokedResponse.status}: ${await revokedResponse.text()}`);
    }

    const backendStdout = backend.getStdout();
    if (!backendStdout.includes("[AI INSIGHTS] Provider: Gemini")) {
      throw new Error(`Live verification did not observe Gemini usage.\nBackend stdout:\n${backendStdout}`);
    }

    process.stdout.write("Live production integration verification passed.\n");
  } finally {
    await stopChild(openclaw.child);
    if (openclaw.getStderr().trim()) {
      process.stderr.write(openclaw.getStderr());
    }
  }
} finally {
  await stopChild(backend.child);
  await new Promise((resolve) => telegramServer.close(resolve));
  if (backend.getStderr().trim()) {
    process.stderr.write(backend.getStderr());
  }
}

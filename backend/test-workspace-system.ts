#!/usr/bin/env node
/**
 * TokenWatch Workspace Authentication & Multi-Workspace System Test
 * 
 * This script validates:
 * 1. User signup and login
 * 2. Workspace creation and management
 * 3. API key generation and rotation
 * 4. API key validation for telemetry ingestion
 * 5. Workspace-isolated analytics
 * 6. Settings management
 * 7. Multiple workspace support
 */

import dotenv from "dotenv";
import http from "http";

// Load environment variables
dotenv.config();

const API_BASE = "http://localhost:3001";

interface TestResult {
  name: string;
  status: "pass" | "fail";
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`[TEST] ${msg}`);
}

function success(msg: string) {
  console.log(`✓ ${msg}`);
}

function error(msg: string) {
  console.error(`✗ ${msg}`);
}

async function request(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; data: any; cookies?: string[] }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options: any = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode || 200,
            data: parsed,
            cookies: res.headers["set-cookie"],
          });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data: { raw: data }, cookies: res.headers["set-cookie"] });
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`HTTP request to ${method} ${path} failed: ${err.message}`));
    });
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function extractCookie(cookies?: string[], name: string = "tokenwatch_auth"): string | null {
  if (!cookies) return null;
  const cookie = cookies.find((c) => c.startsWith(name + "="));
  if (!cookie) return null;
  return cookie.split(";")[0].split("=")[1];
}

async function waitForServer(maxAttempts = 30, delayMs = 1000): Promise<boolean> {
  console.log("[TEST] Checking if server is running on " + API_BASE);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await request("GET", "/api/health");
      console.log("[TEST] Server is ready!");
      return true;
    } catch (err) {
      if (i < maxAttempts - 1) {
        console.log(`[TEST] Server not ready, attempt ${i + 1}/${maxAttempts}. Waiting ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  console.error("[TEST] ✗ Server is not running on " + API_BASE);
  console.error("[TEST] Make sure to start the server with: npm run dev");
  return false;
}

async function test(
  name: string,
  fn: () => Promise<{ pass: boolean; message: string; data?: any }>
) {
  try {
    log(name);
    const result = await fn();
    const status = result.pass ? "pass" : "fail";
    if (result.pass) {
      success(result.message);
    } else {
      error(result.message);
    }
    results.push({
      name,
      status,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    const fullError = err instanceof Error 
      ? `${err.message}\n${err.stack}` 
      : String(err);
    error(`Exception: ${fullError}`);
    results.push({
      name,
      status: "fail",
      message: `Exception: ${fullError}`,
    });
  }
}

async function main() {
  console.log("\n=== TokenWatch Multi-Workspace System Test ===\n");

  // Check if server is running
  const serverReady = await waitForServer();
  if (!serverReady) {
    process.exit(1);
  }

  let authToken = "";
  let workspaceId = "";
  let apiKey = "";
  let workspaceId2 = "";
  let apiKey2 = "";

  // Test 1: Signup
  await test("Signup: Create new user and workspace", async () => {
    const testEmail = `test-${Date.now()}@example.com`;
    const res = await request("POST", "/api/auth/signup", {
      email: testEmail,
      password: "password123",
    });

    if (res.status !== 201 || !res.data.user) {
      return { pass: false, message: `Expected 201 with user data, got ${res.status}` };
    }

    authToken = extractCookie(res.cookies) || "";
    if (!authToken) {
      return { pass: false, message: "No auth cookie received" };
    }

    workspaceId = res.data.workspace?.id;
    apiKey = res.data.workspace?.apiKey?.value;

    if (!workspaceId || !apiKey) {
      return {
        pass: false,
        message: "Missing workspace ID or API key in response",
        data: res.data,
      };
    }

    return {
      pass: true,
      message: `Signed up ${testEmail} with workspace ${workspaceId.slice(0, 8)}...`,
      data: { userId: res.data.user.id, workspaceId, apiKey: apiKey.slice(0, 15) + "..." },
    };
  });

  // Test 2: Get current user info
  await test("Auth: Get current user with workspaces", async () => {
    const res = await request("GET", "/api/auth/me", undefined, {
      cookie: `tokenwatch_auth=${authToken}`,
    });

    if (res.status !== 200 || !res.data.user) {
      return { pass: false, message: `Expected 200 with user data, got ${res.status}` };
    }

    if (!res.data.workspaces || res.data.workspaces.length === 0) {
      return { pass: false, message: "No workspaces returned" };
    }

    const ws = res.data.workspaces[0];
    if (!ws.apiKey) {
      return { pass: false, message: "No API key in workspace data" };
    }

    return {
      pass: true,
      message: `Retrieved user with ${res.data.workspaces.length} workspace(s)`,
      data: { email: res.data.user.email, workspaceCount: res.data.workspaces.length },
    };
  });

  // Test 3: Ingest telemetry with API key
  await test("Ingest: Send telemetry with API key", async () => {
    const telemetryData = {
      requests: [
        {
          route: "POST /api/chat",
          model: "gpt-4",
          provider: "openai",
          status: 200,
          latency_ms: 500,
          input_tokens: 100,
          output_tokens: 50,
          cost_usd: 0.05,
        },
      ],
    };

    const res = await request("POST", "/api/ingest", telemetryData, {
      "X-API-Key": apiKey,
    });

    if (res.status !== 201) {
      return {
        pass: false,
        message: `Expected 201, got ${res.status}. Response: ${JSON.stringify(res.data)}`,
      };
    }

    return {
      pass: true,
      message: `Successfully ingested telemetry with API key`,
      data: res.data,
    };
  });

  // Test 4: Analytics query with workspace filter
  await test("Analytics: Query analytics for workspace", async () => {
    const res = await request("GET", `/api/analytics/snapshot?workspaceId=${workspaceId}`, undefined, {
      cookie: `tokenwatch_auth=${authToken}`,
    });

    if (res.status !== 200 || !res.data.data) {
      return {
        pass: false,
        message: `Expected 200 with analytics data, got ${res.status}`,
      };
    }

    const analytics = res.data.data;
    if (!analytics.overview || !analytics.endpoints || !analytics.models) {
      return {
        pass: false,
        message: "Missing expected analytics fields",
        data: Object.keys(analytics),
      };
    }

    return {
      pass: true,
      message: `Analytics shows ${analytics.endpoints.length} endpoints and spend $${analytics.overview.spendToday.toFixed(2)}`,
      data: {
        spend: analytics.overview.spendToday,
        endpoints: analytics.endpoints.length,
        budget: analytics.overview.budget,
      },
    };
  });

  // Test 5: Invalid API key rejection
  await test("Security: Reject invalid API key", async () => {
    const telemetryData = {
      requests: [
        {
          route: "POST /api/test",
          model: "gpt-4",
          provider: "openai",
          status: 200,
          latency_ms: 100,
          input_tokens: 10,
          output_tokens: 10,
          cost_usd: 0.01,
        },
      ],
    };

    const res = await request("POST", "/api/ingest", telemetryData, {
      "X-API-Key": "tw_sdk_invalid_key_12345",
    });

    if (res.status === 200) {
      return {
        pass: false,
        message: "Invalid API key should be rejected, but request succeeded",
      };
    }

    return {
      pass: true,
      message: `Invalid API key correctly rejected with ${res.status}`,
    };
  });

  // Test 6: Create second workspace
  await test("Workspace: Create additional workspace", async () => {
    const res = await request(
      "POST",
      `/api/workspaces`,
      { name: "Production Workspace" },
      {
        cookie: `tokenwatch_auth=${authToken}`,
      }
    );

    if (res.status !== 201 || !res.data.workspace) {
      return {
        pass: false,
        message: `Expected 201 with workspace, got ${res.status}. Response: ${JSON.stringify(res.data)}`,
      };
    }

    workspaceId2 = res.data.workspace.id;
    apiKey2 = res.data.workspace.apiKey?.value;

    if (!workspaceId2 || !apiKey2) {
      return {
        pass: false,
        message: "Second workspace missing ID or API key",
      };
    }

    return {
      pass: true,
      message: `Created second workspace ${workspaceId2.slice(0, 8)}...`,
      data: { workspaceId: workspaceId2, hasApiKey: !!apiKey2 },
    };
  });

  // Test 7: Update workspace settings
  await test("Settings: Update workspace settings", async () => {
    const res = await request(
      "PUT",
      `/api/workspaces/${workspaceId}/settings`,
      {
        alert_on_high_cost: true,
        alert_on_errors: true,
        alert_cost_threshold: 100,
      },
      {
        cookie: `tokenwatch_auth=${authToken}`,
      }
    );

    if (res.status !== 200) {
      return {
        pass: false,
        message: `Expected 200, got ${res.status}. Response: ${JSON.stringify(res.data)}`,
      };
    }

    return {
      pass: true,
      message: `Updated workspace settings`,
      data: res.data,
    };
  });

  // Test 8: Regenerate API key
  await test("Security: Regenerate API key", async () => {
    const res = await request(
      "POST",
      `/api/workspaces/${workspaceId}/api-keys/regenerate`,
      {},
      {
        cookie: `tokenwatch_auth=${authToken}`,
      }
    );

    if (res.status !== 200 || !res.data.apiKey) {
      return {
        pass: false,
        message: `Expected 200 with new API key, got ${res.status}`,
      };
    }

    const newApiKey = res.data.apiKey;
    if (newApiKey === apiKey) {
      return {
        pass: false,
        message: "New API key is the same as old key",
      };
    }

    // Test that old key is now invalid
    const ingestRes = await request("POST", "/api/ingest", {
      requests: [
        {
          route: "POST /api/test",
          model: "gpt-4",
          provider: "openai",
          status: 200,
          latency_ms: 100,
          input_tokens: 10,
          output_tokens: 10,
          cost_usd: 0.01,
        },
      ],
    }, {
      "X-API-Key": apiKey,
    });

    if (ingestRes.status === 200) {
      return {
        pass: false,
        message: "Old API key should be invalid after rotation",
      };
    }

    // Test that new key works
    const newIngestRes = await request("POST", "/api/ingest", {
      requests: [
        {
          route: "POST /api/test",
          model: "gpt-4",
          provider: "openai",
          status: 200,
          latency_ms: 100,
          input_tokens: 10,
          output_tokens: 10,
          cost_usd: 0.01,
        },
      ],
    }, {
      "X-API-Key": newApiKey,
    });

    if (newIngestRes.status !== 201) {
      return {
        pass: false,
        message: "New API key should work after rotation",
      };
    }

    apiKey = newApiKey;
    return {
      pass: true,
      message: `Successfully rotated API key, old key invalidated`,
      data: { newKeyPrefix: newApiKey.slice(0, 15) + "..." },
    };
  });

  // Test 9: Workspace isolation - second workspace telemetry separate
  await test("Isolation: Telemetry isolated by workspace", async () => {
    // Ingest to workspace 2
    const res = await request("POST", "/api/ingest", {
      requests: [
        {
          route: "GET /api/data",
          model: "gpt-3.5-turbo",
          provider: "openai",
          status: 200,
          latency_ms: 200,
          input_tokens: 50,
          output_tokens: 25,
          cost_usd: 0.02,
        },
      ],
    }, {
      "X-API-Key": apiKey2,
    });

    if (res.status !== 201) {
      return {
        pass: false,
        message: `Failed to ingest to workspace 2: ${res.status}`,
      };
    }

    // Query analytics for workspace 1 - should not see workspace 2 data
    const ws1Analytics = await request(
      "GET",
      `/api/analytics/snapshot?workspaceId=${workspaceId}`,
      undefined,
      {
        cookie: `tokenwatch_auth=${authToken}`,
      }
    );

    // Query analytics for workspace 2
    const ws2Analytics = await request(
      "GET",
      `/api/analytics/snapshot?workspaceId=${workspaceId2}`,
      undefined,
      {
        cookie: `tokenwatch_auth=${authToken}`,
      }
    );

    const ws1Endpoints = ws1Analytics.data.data?.endpoints || [];
    const ws2Endpoints = ws2Analytics.data.data?.endpoints || [];

    // Workspace 1 should have different endpoints than workspace 2
    const ws1Routes = ws1Endpoints.map((e: any) => e.route);
    const ws2Routes = ws2Endpoints.map((e: any) => e.route);

    const hasIsolation = !ws2Routes.every((r: string) => ws1Routes.includes(r));

    return {
      pass: hasIsolation,
      message: hasIsolation
        ? `Workspaces properly isolated: WS1 has ${ws1Endpoints.length} endpoints, WS2 has ${ws2Endpoints.length}`
        : "Workspace data appears to be mixed",
      data: {
        ws1EndpointCount: ws1Endpoints.length,
        ws2EndpointCount: ws2Endpoints.length,
        ws1Routes,
        ws2Routes,
      },
    };
  });

  // Test 10: Logout
  await test("Auth: Logout clears session", async () => {
    const res = await request("POST", "/api/auth/logout", undefined, {
      cookie: `tokenwatch_auth=${authToken}`,
    });

    if (res.status !== 200) {
      return { pass: false, message: `Expected 200, got ${res.status}` };
    }

    // Try to access protected endpoint with old token
    const meRes = await request("GET", "/api/auth/me", undefined, {
      cookie: `tokenwatch_auth=${authToken}`,
    });

    if (meRes.status === 200) {
      return {
        pass: false,
        message: "Should not be able to access protected endpoint after logout",
      };
    }

    return {
      pass: true,
      message: "Logout successful, session invalidated",
    };
  });

  // Print summary
  console.log("\n=== Test Results ===\n");
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  results.forEach((r) => {
    const icon = r.status === "pass" ? "✓" : "✗";
    console.log(`${icon} ${r.name}`);
    console.log(`  ${r.message}`);
    if (r.data) {
      console.log(`  ${JSON.stringify(r.data)}`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed out of ${results.length} tests\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});

import assert from "node:assert/strict";
import test from "node:test";
import { TokenWatch } from "../dist/esm/index.js";
import { __resetTransportForTests } from "../dist/esm/transport.js";

async function withFetch(fetchImpl, run) {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = fetchImpl;
  console.warn = () => {};
  __resetTransportForTests();

  try {
    await run();
  } finally {
    __resetTransportForTests();
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
  }
}

test("init and setEndpoint update the client state", async () => {
  const requests = [];

  await withFetch(
    async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 204 });
    },
    async () => {
    TokenWatch.init({
      apiUrl: "http://localhost:4000",
      workspaceId: "demo-app",
      apiKey: "test-key-123"
    });

    TokenWatch.setEndpoint("/api/telemetry");
    await TokenWatch.track("request.sent", { properties: { route: "/api/chat" } });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://localhost:4000/api/telemetry");

    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.event, "request.sent");
    assert.equal(body.workspace_id, "demo-app");
    assert.equal(requests[0].init.headers["X-TokenWatch-Workspace"], "demo-app");
    assert.ok(requests[0].init.headers["X-TokenWatch-Timestamp"]);
    assert.ok(requests[0].init.headers["X-TokenWatch-Nonce"]);
    assert.ok(requests[0].init.headers["X-TokenWatch-Signature"]);
    }
  );
});

test("simulate sends a realistic telemetry payload", async () => {
  const requests = [];

  await withFetch(
    async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 204 });
    },
    async () => {
    TokenWatch.init({
      apiUrl: "http://localhost:4000",
      workspaceId: "demo-app",
      apiKey: "test-key-456",
      endpoint: "/api/requests"
    });

    const record = await TokenWatch.simulate({
      provider: "openai",
      model: "gpt-4o",
      endpoint: "/api/chat"
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://localhost:4000/api/requests");
    assert.equal(record.route, "/api/chat");
    assert.equal(record.provider, "OpenAI");
    assert.equal(record.model, "gpt-4o");
    }
  );
});

test("init can resolve workspace from API key identity", async () => {
  const requests = [];

  await withFetch(
    async (url, init) => {
      requests.push({ url, init });
      if (url === "http://localhost:4000/api/me") {
        return new Response(JSON.stringify({ identity: { workspace: { id: "ws_from_key" } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(null, { status: 204 });
    },
    async () => {
      TokenWatch.init({
        apiUrl: "http://localhost:4000",
        apiKey: "tw_sdk_test_key"
      });

      await TokenWatch.track("request.sent", { route: "/api/chat" });
      await TokenWatch.flush();

      assert.equal(requests.length, 2);
      assert.equal(requests[0].url, "http://localhost:4000/api/me");
      assert.equal(requests[0].init.headers.Authorization, "Bearer tw_sdk_test_key");
      assert.equal(requests[1].url, "http://localhost:4000/ingest");
      assert.equal(requests[1].init.headers["X-TokenWatch-Workspace"], "ws_from_key");
      assert.equal(JSON.parse(requests[1].init.body).workspace_id, "ws_from_key");
    }
  );
});

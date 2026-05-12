import assert from "node:assert/strict";
import test from "node:test";
import { TokenWatch } from "../dist/esm/index.js";

test("init and setEndpoint update the client state", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response(null, { status: 204 });
  };

  try {
    TokenWatch.init({
      apiUrl: "http://localhost:4000",
      projectId: "demo-app"
    });

    TokenWatch.setEndpoint("/api/telemetry");
    await TokenWatch.track("request.sent", { properties: { route: "/api/chat" } });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "http://localhost:4000/api/telemetry");

    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.event, "request.sent");
    assert.equal(body.projectId, "demo-app");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("simulate sends a realistic telemetry payload", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response(null, { status: 204 });
  };

  try {
    TokenWatch.init({
      apiUrl: "http://localhost:4000",
      projectId: "demo-app",
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});
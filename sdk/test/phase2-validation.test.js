import assert from "node:assert/strict";
import test from "node:test";
import { TokenWatch, flushAndShutdown, getQueueSize, getTransportStats } from "../dist/esm/index.js";
import { classifyError, createRetryPolicy } from "../dist/esm/internal/retryPolicy.js";
import { __resetTransportForTests } from "../dist/esm/transport.js";

function initTransport(options = {}) {
  TokenWatch.init({
    apiKey: "test-key",
    workspaceId: "test-workspace",
    apiUrl: "http://localhost:3000",
    endpoint: "/ingest",
    flushInterval: 10,
    batchSize: 50,
    retryAttempts: 1,
    ...options
  });
}

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

test("retry classification treats 4xx as permanent and 5xx/network/timeout as retryable", () => {
  assert.equal(classifyError(new Error("TokenWatch request failed with 401: Unauthorized")), "permanent");
  assert.equal(classifyError(new Error("TokenWatch request failed with 422: invalid")), "permanent");
  assert.equal(classifyError(new Error("TokenWatch request failed with 503: unavailable")), "retryable");
  assert.equal(classifyError(new Error("fetch failed: ECONNREFUSED")), "retryable");
  assert.equal(classifyError(new Error("AbortError: timed out")), "timeout");
});

test("retry policy uses bounded jittered backoff", () => {
  const policy = createRetryPolicy();
  const values = Array.from({ length: 20 }, () => policy.getBackoffMs(2));

  assert.ok(values.every((value) => value >= 120 && value <= 280));
  assert.ok(new Set(values).size > 1, "jitter should vary retry delays");
});

test("manual flush batches concurrent events and resolves when delivery completes", async () => {
  const requests = [];

  await withFetch(
    async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 204 });
    },
    async () => {
      initTransport({ flushInterval: 10_000, batchSize: 50 });

      const pending = [
        TokenWatch.track("event.one"),
        TokenWatch.track("event.two"),
        TokenWatch.track("event.three")
      ];

      assert.equal(getQueueSize(), 3);
      await TokenWatch.flush();
      await Promise.all(pending);

      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, "http://localhost:3000/ingest");

      const body = JSON.parse(requests[0].init.body);
      assert.equal(body.data.length, 3);
      assert.deepEqual(body.data.map((item) => item.event), ["event.one", "event.two", "event.three"]);
      assert.equal(getTransportStats().queueSize, 0);
    }
  );
});

test("enqueue during an active flush is delivered by a follow-up flush", async () => {
  let releaseFirst;
  const requests = [];

  await withFetch(
    async (_url, init) => {
      requests.push(JSON.parse(init.body));
      if (requests.length === 1) {
        await new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return new Response(null, { status: 204 });
    },
    async () => {
      initTransport({ flushInterval: 10_000, batchSize: 1 });

      const first = TokenWatch.track("first");
      await waitUntil(() => getTransportStats().isFlushing);
      await waitUntil(() => typeof releaseFirst === "function");

      const second = TokenWatch.track("second");
      assert.equal(getQueueSize(), 1);

      releaseFirst();
      await Promise.all([first, second]);

      assert.equal(requests.length, 2);
      assert.equal(requests[0].event, "first");
      assert.equal(requests[1].event, "second");
      assert.equal(getQueueSize(), 0);
    }
  );
});

test("queue overflow rejects excess events without growing past maxQueueSize", async () => {
  await withFetch(
    async () => new Response(null, { status: 204 }),
    async () => {
      initTransport({ maxQueueSize: 2, flushInterval: 10_000, batchSize: 50 });

      const first = TokenWatch.track("queued.one");
      const second = TokenWatch.track("queued.two");
      const overflow = TokenWatch.track("queued.three");

      await assert.rejects(overflow, /queue capacity exceeded/);
      assert.equal(getQueueSize(), 2);
      assert.equal(getTransportStats().rejected, 1);

      await TokenWatch.flush();
      await Promise.all([first, second]);
      assert.equal(getQueueSize(), 0);
    }
  );
});

test("4xx responses do not retry", async () => {
  let calls = 0;

  await withFetch(
    async () => {
      calls++;
      return new Response("unauthorized", { status: 401 });
    },
    async () => {
      initTransport({ retryAttempts: 3 });

      await assert.rejects(TokenWatch.track("bad.credentials"), /401/);
      assert.equal(calls, 1);
      assert.equal(getTransportStats().retries, 0);
    }
  );
});

test("5xx responses and network failures retry conservatively", async () => {
  let serverCalls = 0;
  await withFetch(
    async () => {
      serverCalls++;
      return serverCalls === 1 ? new Response("unavailable", { status: 503 }) : new Response(null, { status: 204 });
    },
    async () => {
      initTransport({ retryAttempts: 2 });
      await TokenWatch.track("server.retry");
      assert.equal(serverCalls, 2);
      assert.equal(getTransportStats().retries, 1);
    }
  );

  let networkCalls = 0;
  await withFetch(
    async () => {
      networkCalls++;
      throw new Error("fetch failed: ECONNREFUSED");
    },
    async () => {
      initTransport({ retryAttempts: 2 });
      await assert.rejects(TokenWatch.track("offline.retry"), /ECONNREFUSED/);
      assert.equal(networkCalls, 2);
      assert.equal(getTransportStats().retries, 1);
    }
  );
});

test("flushAndShutdown clears scheduled work and flushes the queue", async () => {
  const requests = [];

  await withFetch(
    async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return new Response(null, { status: 204 });
    },
    async () => {
      initTransport({ flushInterval: 10_000, batchSize: 50 });

      const pending = TokenWatch.track("shutdown.flush");
      assert.equal(getTransportStats().scheduled, true);

      await flushAndShutdown(1000);
      await pending;

      assert.equal(requests.length, 1);
      assert.equal(requests[0].event, "shutdown.flush");
      assert.equal(getTransportStats().scheduled, false);
      assert.equal(getQueueSize(), 0);
    }
  );
});

test("high-volume simulation respects queue bounds and stopSimulation cleans its timer", async () => {
  await withFetch(
    async () => {
      throw new Error("fetch failed: ECONNREFUSED");
    },
    async () => {
      initTransport({ maxQueueSize: 25, flushInterval: 10_000, retryAttempts: 1 });

      const simulation = TokenWatch.startSimulation({ profile: "high", intervalMs: 100, jitterMs: 0 });
      await sleep(350);
      TokenWatch.stopSimulation();
      await TokenWatch.flush();

      assert.equal(simulation.running, false);
      assert.ok(getQueueSize() <= 25);
      assert.ok(getTransportStats().queueSize <= 25);
    }
  );
});

test("simulation traffic profiles preserve lightweight presets", async () => {
  await withFetch(
    async () => new Response(null, { status: 204 }),
    async () => {
      initTransport();

      const low = TokenWatch.startSimulation({ profile: "low" });
      assert.equal(low.running, true);
      low.stop();

      const high = TokenWatch.startSimulation({ profile: "high" });
      assert.equal(high.running, true);
      high.stop();
    }
  );
});

async function waitUntil(predicate, timeoutMs = 500) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("condition was not met before timeout");
    }
    await sleep(5);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

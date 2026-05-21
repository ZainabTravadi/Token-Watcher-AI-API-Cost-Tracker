# TokenWatch SDK

This document describes the real, implemented behaviors of the TokenWatch JavaScript SDK (source: `sdk/src/`). It focuses on operational details important to users integrating the SDK into apps and services.

## Installation

```bash
npm install --save path-to-tokenwatch-sdk
```

For local development the SDK source is in `sdk/src/` and builds to `dist/` via `npm run build`.

## Initialization

Required fields:
- `apiKey` (workspace API key, format `tw_live_...`)
- `workspaceId` (workspace id from the dashboard)
- `apiUrl` (backend base URL)

Minimal example:

```js
import * as TokenWatch from 'tokenwatch';

TokenWatch.init({ apiUrl: 'http://localhost:3001', workspaceId: 'ws_...', apiKey: 'tw_live_...' });
```

On init the SDK:
- configures an in-memory bounded queue
- sets default transport parameters (batch size, flush interval, retry attempts)
- registers a shutdown handler that flushes outstanding events

If `init()` is called multiple times the previous configuration is replaced (a console warning is emitted).

## API

- `track(name, options)` — enqueue an event. If not initialized the call is ignored (warning).
- `identify(id, traits)` — set the identity state and emit an identify record.
- `simulate(opts)` — send a single synthetic telemetry record (useful for tests).
- `startSimulation(opts)` — starts a background timer that repeatedly calls `simulate()`; it backs off if the transport queue is under pressure.
- `stopSimulation()` — stops the simulation timer.
- `flush()` — waits for the transport to flush queued events.
- `stats()` — returns transport stats: queue size, max queue, in-flight requests, etc.

## Batching, queueing, retries (real behavior)

- The SDK maintains a bounded queue (default max 1000). When the queue is full `postJson()` rejects and the event is not enqueued; the SDK exposes `rejected` counts in `stats()`.
- `batchSize` defaults to 50. When the queue reaches `batchSize` a flush is triggered immediately; otherwise events are flushed on a `flushInterval` timer (default 25ms).
- Delivery groups events by `(apiUrl, endpoint, workspaceId, headers)` to send compatible batches together.
- Retry policy: transient errors (network failures and 5xx) are retried with jittered backoff up to `retryAttempts` (default 3). 4xx responses (client errors) are treated as permanent failures for that request.

## Backpressure and graceful shutdown

- `startSimulation()` checks transport `stats()` and backs off if `queueSize >= maxQueueSize * 0.8` (configurable) to avoid overload.
- The SDK registers a shutdown hook that attempts a `flushAndShutdown(timeoutMs)` to deliver outstanding events before process exit. `flush()` resolves when queued delivery completes (or rejects on error).

## Production recommendations

- Set `apiUrl` to a stable, closely located endpoint to reduce latency and reduce in-flight timeouts.
- Tune `batchSize` and `flushInterval` for your traffic pattern: smaller batches reduce memory but increase request rate; larger batches reduce overhead but increase latency.
- Keep `maxQueueSize` high enough for burst tolerance, but monitor `stats().rejected` to detect overflows.
- Call `await TokenWatch.flush()` during graceful shutdown (server stop, worker restart) to avoid event loss.

## Error handling

- `track()` and other methods return Promises that resolve when the event is accepted into the SDK queue; delivery errors during flush are surfaced via rejected Promises on the grouped requests and metrics (see `stats()`).

## Limitations

- The SDK does not persist events across process restarts — in-memory queue only.
- The SDK provides bounded-memory guarantees; events are dropped when the queue is full.

## Example: graceful shutdown in Node

```js
import * as TokenWatch from 'tokenwatch';

TokenWatch.init({ apiUrl: 'https://api', workspaceId: 'ws_x', apiKey: 'tw_live_x' });

process.on('SIGINT', async () => {
  try {
    await TokenWatch.flush();
  } finally {
    process.exit(0);
  }
});
```
# TokenWatch SDK

TokenWatch is a lightweight TypeScript SDK for simulated AI telemetry generation and observability testing.

It is designed to feel simple and Firebase-like:

- one namespace export: `TokenWatch`
- minimal setup
- browser and Node.js support
- zero runtime dependencies

## Install

This package is structured as a standalone workspace folder in this repository. Publish or link the `sdk/` folder as the `tokenwatch` package for external use.

## Quick Start

```ts
import { TokenWatch } from "tokenwatch";

TokenWatch.init({
  apiUrl: "http://localhost:4000",
  workspaceId: "demo-app",
  apiKey: "tw_demo_key"
});

TokenWatch.simulate({
  provider: "openai",
  model: "gpt-4o",
  endpoint: "/api/chat"
});

await TokenWatch.flush();
```

## API

- `init(options)` configures the SDK.
- `setEndpoint(endpoint)` changes the ingestion endpoint.
- `flush()` immediately flushes queued telemetry and resolves when delivery finishes.
- `stats()` returns queue, retry, flush, and rejection counters for optional debug visibility.
- `track(name, properties?)` sends a custom event.
- `identify(id, traits?)` stores user identity and sends an identify event.
- `simulate(options?)` sends one simulated telemetry record.
- `startSimulation(options?)` begins a recurring simulation loop.
- `stopSimulation()` stops the recurring simulation loop.

### Optional operational controls

`init()` also accepts lightweight production controls:

```ts
TokenWatch.init({
  apiUrl: "https://api.example.com",
  workspaceId: "demo-app",
  apiKey: "tw_live_key",
  maxQueueSize: 1000,
  batchSize: 50,
  flushInterval: 25,
  retryAttempts: 3,
  debug: false
});
```

Simulation traffic can use simple presets:

```ts
TokenWatch.startSimulation({ profile: "low" });
TokenWatch.startSimulation({ profile: "medium" });
TokenWatch.startSimulation({ profile: "high" });
```

## Notes

- The SDK targets the `/ingest` ingestion endpoint by default.
- Node.js support uses the built-in `fetch` runtime available in current LTS releases.
- The package is intentionally dependency-free to keep bundle size small.
- Debug logging is off by default. Use `debug: true` only for development and operational inspection.

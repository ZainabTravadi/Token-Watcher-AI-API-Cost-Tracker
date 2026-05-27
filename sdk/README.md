# TokenWatch SDK

Send application telemetry to TokenWatch with a small dependency-free TypeScript SDK.

## Install

```bash
npm install tokenwatch
```

## Quick Start

```ts
import * as TokenWatch from "tokenwatch";

TokenWatch.init({
  apiUrl: "https://your-tokenwatch-api.example.com",
  workspaceId: "ws_xxxxxxxx",
  apiKey: process.env.TOKENWATCH_API_KEY!
});

await TokenWatch.track("llm.request.completed", {
  route: "/api/chat",
  provider: "YourProvider",
  model: "your-model",
  input_tokens: 120,
  output_tokens: 80,
  cost_usd: 0.0042,
  latency_ms: 640,
  properties: {
    requestId: "req_123"
  }
});

await TokenWatch.flush();
```

The dashboard derives models, providers, endpoints, filters, charts, and recent activity from the telemetry rows you send.

## API

- `init(options)` configures the SDK.
- `track(name, options)` sends one telemetry event.
- `identify(id, traits)` stores identity context and emits an identify event.
- `flush()` immediately flushes queued telemetry.
- `stats()` returns queue, retry, flush, and rejection counters.
- `setEndpoint(endpoint)` changes the ingestion endpoint. The default is `/ingest`.

Simulation helpers are available for local testing:

- `simulate(options)`
- `startSimulation(options)`
- `stopSimulation()`

## Track Options

```ts
await TokenWatch.track("llm.request.completed", {
  route: "/v1/agents",
  provider: "YourProvider",
  model: "your-model",
  input_tokens: 1200,
  output_tokens: 450,
  total_tokens: 1650,
  cost_usd: 0.032,
  latency_ms: 910,
  error: null,
  properties: {
    requestId: "req_123",
    tenant: "acme"
  }
});
```

All string dimensions are open-ended. TokenWatch does not require a predefined provider, model, or route list.

## Production Notes

- Keep `TOKENWATCH_API_KEY` server-side. Do not expose workspace API keys to browsers.
- Call `await TokenWatch.flush()` during graceful shutdown.
- Monitor `TokenWatch.stats().rejected` for queue pressure.
- Tune `batchSize`, `flushInterval`, `maxQueueSize`, and `retryAttempts` only if your traffic pattern needs it.

## Transport Behavior

The SDK uses an in-memory bounded queue, batches compatible events, retries transient network and 5xx failures, and treats 4xx responses as permanent configuration/authentication errors.

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

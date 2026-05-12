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
  projectId: "demo-app"
});

TokenWatch.simulate({
  provider: "openai",
  model: "gpt-4o",
  endpoint: "/api/chat"
});
```

## API

- `init(options)` configures the SDK.
- `setEndpoint(endpoint)` changes the ingestion endpoint.
- `track(name, properties?)` sends a custom event.
- `identify(id, traits?)` stores user identity and sends an identify event.
- `simulate(options?)` sends one simulated telemetry record.
- `startSimulation(options?)` begins a recurring simulation loop.
- `stopSimulation()` stops the recurring simulation loop.

## Notes

- The SDK targets a simple ingestion endpoint by default: `/api/requests`.
- Node.js support uses the built-in `fetch` runtime available in current LTS releases.
- The package is intentionally dependency-free to keep bundle size small.
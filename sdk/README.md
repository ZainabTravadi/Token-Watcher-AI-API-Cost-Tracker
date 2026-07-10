# TokenWatch SDK

Small, dependency-free TypeScript SDK to send telemetry to a TokenWatch backend.

## 5-Minute Quick Start

1. Install the package.

```bash
npm install @zn_/tokenwatch
```

2. Create an SDK API key in TokenWatch Settings > API Keys.

3. Initialize the SDK.

```ts
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
  apiUrl: "https://your-tokenwatcher-backend.example",
  apiKey: process.env.TOKENWATCH_API_KEY!
});
```

4. Send telemetry.

```ts
await TokenWatch.track("llm.request.completed", {
  route: "/api/chat",
  provider: "openai",
  model: "gpt-4o",
  input_tokens: 120,
  output_tokens: 80,
  cost_usd: 0.0042,
  latency_ms: 640
});
```

5. Flush before exit.

```ts
await TokenWatch.flush();
```

6. Verify in the dashboard.

Look in Overview, Recent Activity, Endpoints, and Models after the first event lands.

## Why `flush()` Matters

Telemetry is batched. Short-lived scripts and serverless functions may exit before queued events are delivered, so call `await TokenWatch.flush()` before shutdown.

## API Reference

- `init(options)` - required: `apiKey`. Optional: `apiUrl`, `batchSize`, `flushInterval`, `maxQueueSize`, `retryAttempts`, `requestTimeoutMs`, `debug`.
- `track(eventName, payload)` - enqueue a telemetry record.
- `identify(id, traits)` - attach identity context for subsequent events.
- `flush()` - force sending queued events and wait for completion.
- `stats()` - return runtime counters.

## Troubleshooting

- Confirm the backend URL is reachable.
- Confirm the API key starts with `tw_sdk_`, is active, and is not expired.
- Confirm you called `flush()` before a short-lived process exited.
- Clear dashboard filters if telemetry was ingested but is not visible.

## Security

- Keep API keys server-side.
- Do not embed production API keys in browser JavaScript.
- Workspace identity is resolved from the API key by the backend.

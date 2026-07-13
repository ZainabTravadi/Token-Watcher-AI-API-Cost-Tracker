# SDK

TokenWatch ships a small TypeScript SDK for sending telemetry to the backend.
It is dependency-light, workspace-aware, and designed to be safe in short-lived processes.

## Table Of Contents

- [Install](#install)
- [Initialize](#initialize)
- [Configure](#configure)
- [Track Events](#track-events)
- [Identity](#identity)
- [Flush And Shutdown](#flush-and-shutdown)
- [Supported Events](#supported-events)
- [Payload Schema](#payload-schema)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Error Handling](#error-handling)

## Install

```bash
npm install @zn_/tokenwatch
```

## Initialize

```ts
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
  apiUrl: "http://localhost:3001",
  apiKey: process.env.TOKENWATCH_API_KEY!,
});
```

`apiKey` is required.
`apiUrl` defaults to the hosted backend URL if you do not override it.

## Configure

| Option | Purpose |
|---|---|
| `apiKey` | Required workspace API key |
| `apiUrl` | Backend base URL |
| `workspaceId` | Optional pre-resolved workspace ID |
| `endpoint` | Ingest route override |
| `headers` | Extra request headers |
| `maxQueueSize` | Bounded queue limit |
| `batchSize` | Number of requests per flush batch |
| `flushInterval` | Time before queued requests are flushed |
| `retryAttempts` | Delivery retry count |
| `requestTimeoutMs` | Per-request timeout |
| `debug` | Verbose transport logging |

## Track Events

`track()` records a telemetry event and queues it for delivery.

```ts
await TokenWatch.track("llm.request.completed", {
  route: "/api/chat",
  provider: "openai",
  model: "gpt-4o",
  input_tokens: 120,
  output_tokens: 80,
  cost_usd: 0.0042,
  latency_ms: 640,
});
```

## Identity

`identify()` attaches a stable identity to later events.

```ts
await TokenWatch.identify("user_123", {
  plan: "pro",
  team: "platform",
});
```

## Flush And Shutdown

Telemetry is batched.
Call `await TokenWatch.flush()` before a process exits.

```ts
await TokenWatch.flush();
```

The transport also registers a shutdown handler so queued telemetry gets a best-effort final flush.

## Supported Events

The SDK does not force one event vocabulary.
The application chooses event names, and TokenWatch normalizes them into canonical telemetry rows.

Common events:

▪️ `llm.request.completed`
▪️ `identify`
▪️ `simulate`

Helper APIs:

▪️ `track(name, options)`
▪️ `identify(id, traits)`
▪️ `simulate(options)`
▪️ `startSimulation(options)`
▪️ `stopSimulation()`
▪️ `stats()`

## Payload Schema

| Field | Type | Notes |
|---|---|---|
| `name` | string | Event name passed to `track()` |
| `timestamp` | number | Optional epoch milliseconds |
| `route` / `endpoint` | string | API route or logical endpoint |
| `provider` | string | Provider name such as `openai` or `anthropic` |
| `model` | string | Model identifier |
| `input_tokens` | number | Prompt token count |
| `output_tokens` | number | Completion token count |
| `total_tokens` | number | Optional override; otherwise derived |
| `cost_usd` | number | Request cost in USD |
| `latency_ms` | number | Request latency in milliseconds |
| `error` | string or null | Error label when a request fails |
| `properties` | object | Extra metadata copied onto the record |

The SDK also adds:

▪️ a generated telemetry id
▪️ the resolved workspace id
▪️ identity metadata when available

## Best Practices

▪️ initialize the SDK once during application startup
▪️ call `flush()` in serverless functions and CLI jobs
▪️ keep API keys server-side
▪️ use `properties` for rarely queried metadata
▪️ prefer `route` and `model` values that are consistent across your application
▪️ keep request payloads small and predictable

## Examples

### Node.js

```ts
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
  apiUrl: process.env.TOKENWATCH_API_URL!,
  apiKey: process.env.TOKENWATCH_API_KEY!,
});
```

### Express

```ts
app.post("/api/chat", async (req, res) => {
  const started = Date.now();
  const result = await callModel(req.body);

  await TokenWatch.track("llm.request.completed", {
    route: "/api/chat",
    provider: result.provider,
    model: result.model,
    input_tokens: result.usage.input,
    output_tokens: result.usage.output,
    cost_usd: result.costUsd,
    latency_ms: Date.now() - started,
  });

  res.json(result.data);
});
```

### Next.js

```ts
export async function POST(request: Request) {
  const started = Date.now();
  const payload = await request.json();
  const result = await callModel(payload);

  await TokenWatch.track("llm.request.completed", {
    route: "/api/chat",
    provider: result.provider,
    model: result.model,
    input_tokens: result.usage.input,
    output_tokens: result.usage.output,
    cost_usd: result.costUsd,
    latency_ms: Date.now() - started,
  });

  await TokenWatch.flush();
  return Response.json(result.data);
}
```

## Error Handling

▪️ Calling `track()` before `init()` logs a warning and ignores the event.
▪️ The transport retries temporary failures with backoff.
▪️ 4xx responses are treated as permanent failures.
▪️ Queue overflow is bounded so memory use stays predictable.
▪️ `stats()` exposes queue size, retries, rejections, and the last error.

## Related Docs

▪️ [`architecture.md`](architecture.md)
▪️ [`api.md`](api.md)
▪️ [`deployment.md`](deployment.md)

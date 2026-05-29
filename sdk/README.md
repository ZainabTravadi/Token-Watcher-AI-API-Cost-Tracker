# TokenWatch SDK

Small, dependency-free TypeScript SDK to send telemetry to a TokenWatch backend.

Install

 ```bash
 npm install @zn_/tokenwatch
 ```

5-Minute Quick Start

1. Install the package.

```bash
npm install @zn_/tokenwatch
```

2. Initialize the SDK.

```ts
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
  apiUrl: "http://localhost:3001",
  workspaceId: "ws_xxxxxxxx",
  apiKey: "tw_live_xxxxxxxx"
});
```

3. Send telemetry.

```ts
await TokenWatch.track(
  "llm.request.completed",
  {
    route: "/api/chat",
    provider: "openai",
    model: "gpt-4o",
    input_tokens: 120,
    output_tokens: 80,
    cost_usd: 0.0042,
    latency_ms: 640
  }
);
```

4. Flush before exit.

```ts
await TokenWatch.flush();
```

5. Verify in dashboard.

Look in **Overview**, **Recent Activity**, **Endpoints**, and **Models** after the first event lands.

Get your credentials

1. Create an account in the dashboard.
2. A default workspace is created automatically when you sign up.
3. Copy the Workspace ID from the sidebar.
4. Open Settings → API Keys to view or rotate your API key.
5. Use `http://localhost:3001` for local development.
6. Use your hosted backend URL when you deploy TokenWatch.

```ts
TokenWatch.init({
  apiUrl: "http://localhost:3001",
  workspaceId: "ws_xxxxxxxx",
  apiKey: "tw_live_xxxxxxxx"
});
```

First Telemetry Event

```ts
import { TokenWatch } from '@zn_/tokenwatch';

TokenWatch.init({ apiUrl: 'http://localhost:3001', workspaceId: 'ws_xxxxxxxx', apiKey: 'tw_live_xxxxxxxx' });
await TokenWatch.track('llm.request.completed', { route: '/api/chat', provider: 'openai', model: 'gpt-4o' });
await TokenWatch.flush();
```

Why flush() matters

> **Warning:** TokenWatch batches telemetry before delivery. A short Node script can exit before the queued event leaves the process unless you call `flush()`.

- SDK batches events before sending them.
- Node scripts can exit before delivery completes.
- `flush()` guarantees queued telemetry is sent before shutdown.

Troubleshooting

### No data appears

- Is the backend running?
- Is the `apiUrl` correct?
- Is the `workspaceId` correct?
- Is the API key valid?
- Did you call `flush()`?
- Are you looking at the correct workspace?

### Events visible in API but not dashboard

- The dashboard aggregates data by workspace.
- Verify the workspace selection in the sidebar.
- Refresh the page.
- Check the **Recent Activity** table.

### Realtime stream disconnected

- SSE reconnects automatically.
- Restarting localhost can temporarily disconnect the stream.
- Refresh the browser if the stream does not recover quickly.

Core concepts

- Bounded in-memory queue: prevents unbounded memory growth.
- Batching: `batchSize` + `flushInterval` reduce requests to the ingest API.
- Retry policy: network & 5xx errors are retried with jittered backoff; 4xx errors are treated as permanent.

API reference (essentials)

- `init(options)` — required: `apiUrl`, `workspaceId`, `apiKey`. Optional: `batchSize`, `flushInterval`, `maxQueueSize`, `retryAttempts`.
- `track(eventName, payload)` — enqueue a telemetry record.
- `identify(id, traits)` — attach identity context for subsequent events.
- `flush()` — force sending queued events and wait for completion (call at shutdown).
- `stats()` — returns runtime counters (queue size, rejected, in-flight, lastError).

Examples

- Node (server-side):

```js
import { TokenWatch } from '@zn_/tokenwatch';

TokenWatch.init({ apiUrl: 'https://tokenwatch.example', workspaceId: 'ws_x', apiKey: process.env.TOKENWATCH_API_KEY });
await TokenWatch.track('request.completed', { route: '/api/chat', provider: 'openai', model: 'gpt-4o' });
await TokenWatch.flush();
```

- Express middleware pattern (server):

```js
// inside your request handler
await TokenWatch.track('request.completed', {
  route: req.path,
  provider: 'openai',
  model: 'gpt-4o',
  latency_ms: duration
});
```

Recommendations

- Keep `workspaceId` and `apiKey` server-side; never embed production API keys in browser JS.
- Call `await TokenWatch.flush()` on process shutdown to avoid lost events.
- Monitor `stats().rejected` and tune `maxQueueSize`/`batchSize` for high-throughput services.

Common mistakes

- Sending workspace API keys to browsers (do not). Use a server-side proxy if frontend-originated events are required.
- Expecting immediate guarantee: SDK batches and retries; small delays are normal.

How telemetry appears in the dashboard

- Each row becomes a request record (route, model, provider, tokens, cost, latency, error).
- The dashboard aggregates these rows into endpoints, models, timeline, and recent activity and receives live rows via SSE.


# TokenWatch SDK

Small, dependency-free TypeScript SDK to send telemetry to a TokenWatch backend.

Install

 ```bash
 npm install @zn_/tokenwatch
 ```

Need credentials?

- Workspace ID
  - Dashboard → Sidebar → Copy Workspace ID
- API Key
  - Dashboard → Settings → API Keys
- apiUrl
  - Local: [http://localhost:3001](http://localhost:3001)
  - Hosted: your deployed backend URL

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

### Expected Result

- ✓ Overview page updates
- ✓ Recent Activity shows a new row
- ✓ Endpoint appears in analytics
- ✓ Stream status shows connected

Why flush() matters

> **Warning:** Telemetry is batched. Short-lived scripts and serverless functions may exit before queued events are delivered.

Always call:

```ts
await TokenWatch.flush();
```

before shutdown.

Troubleshooting

- No data appearing?
  1. Is backend running?
  2. Is `apiUrl` correct?
  3. Is `workspaceId` correct?
  4. Is API key valid?
  5. Did you call `flush()`?
  6. Are filters cleared?

- If events appear in the API but not the dashboard, verify the workspace selection in the sidebar and refresh the page.
- If the realtime stream disconnects, SSE reconnects automatically; localhost restarts can temporarily disconnect the stream.

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


# TokenWatch — AI telemetry and cost monitoring

## What is TokenWatch?

TokenWatch is a lightweight AI telemetry and cost monitoring platform.
It helps teams track token usage, model costs, latency, failures, and endpoint activity through a lightweight SDK and dashboard.

## Why TokenWatch?

Many tools require proxying AI traffic through a third-party service.
TokenWatch takes a different approach: instrument your application directly, keep provider integrations unchanged, retain control of request flow, and monitor usage through telemetry.

### TokenWatch vs Proxy-Based Monitoring

- TokenWatch instruments your app directly instead of forcing traffic through a proxy.
- Your provider SDKs stay unchanged, so you keep the integration patterns you already use.
- You keep control of request flow while still collecting telemetry for analytics and cost monitoring.

## How TokenWatch Works

- Backend: ingest API, analytics, authentication, and storage.
- Dashboard: workspaces, analytics, and realtime monitoring.
- SDK: telemetry collection, batching, and delivery.

This repository contains three main parts:
- `backend/` — TypeScript Express API, authentication, ingest pipeline, analytics, and SSE streaming backed by SQLite (better-sqlite3).
- `frontend/` — React + Vite dashboard for workspace-level analytics, request logs and realtime updates.
- `sdk/` — Small, dependency‑free TypeScript SDK that batches and delivers telemetry to the ingest API.

The README below is a concise developer guide: quick start, core concepts, and where to look for implementation details.

## Workspace Lifecycle

- Signing up creates a default workspace automatically.
- Telemetry is isolated per workspace.
- Switching workspaces changes the analytics context in the dashboard.
- Deleting or changing workspaces affects what you can see in analytics and recent activity.

## API Key Lifecycle

- API keys are workspace-scoped.
- API keys authenticate telemetry ingestion.
- Rotating a key invalidates the previous key.
- SDK deployments must be updated after rotation.

> **Warning:** If you rotate an API key, update every deployed SDK instance that uses it before the old key is removed from service.

## Installation

```bash
npm install @zn_/tokenwatch
```

## 5-Minute Quick Start

1. Install the package.

```bash
npm install @zn_/tokenwatch
```

2. Initialize the SDK.

```js
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
	apiUrl: "http://localhost:3001",
	workspaceId: "ws_xxxxxxxx",
	apiKey: "tw_live_xxxxxxxx"
});
```

3. Send telemetry.

```js
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

```js
await TokenWatch.flush();
```

5. Verify in dashboard.

Look in **Overview**, **Recent Activity**, **Endpoints**, and **Models** after the first event lands.

## Get your credentials

1. Create an account in the dashboard.
2. A default workspace is created automatically when you sign up.
3. Copy the Workspace ID from the sidebar.
4. Open Settings → API Keys to view or rotate your API key.
5. Use `http://localhost:3001` for local development.
6. Use your hosted backend URL when you deploy TokenWatch.

```js
TokenWatch.init({
	apiUrl: "http://localhost:3001",
	workspaceId: "ws_xxxxxxxx",
	apiKey: "tw_live_xxxxxxxx"
});
```

## First Telemetry Event

```js
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({ apiUrl: "http://localhost:3001", workspaceId: "ws_xxxxxxxx", apiKey: "tw_live_xxxxxxxx" });
await TokenWatch.track("llm.request.completed", { route: "/api/chat", provider: "openai", model: "gpt-4o" });
await TokenWatch.flush();
```

## Why flush() matters

> **Warning:** TokenWatch batches telemetry before delivery. A short Node script can exit before the queued event leaves the process unless you call `flush()`.

- SDK batches events before sending them.
- Node scripts can exit before delivery completes.
- `flush()` guarantees queued telemetry is sent before shutdown.

## Troubleshooting

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

## Deployment

See [Deployment Guide](./DEPLOYMENT.md) for local development commands, hosted deployment checklists, backups, and retention guidance.

 ## What the system does (short)

 - SDK queues events in memory, batches them, and POSTs to `POST /api/ingest` with `X-API-Key`.
 - Backend authenticates the key, normalizes telemetry, writes the `requests` table in SQLite (WAL), emits an event on `telemetryBus`, and invalidates analytics caches.
 - Frontend subscribes to `/api/telemetry/stream` (SSE) for workspace-scoped live rows and refreshes analytics views.

 ## Core features

 - Workspace isolation (API keys).
 - SDK batching, retries, and graceful shutdown (`flush()`).
 - Realtime SSE updates and cache invalidation for low-latency dashboards.
 - Opt-in retention and backup scripts for operational maintenance.

## 📁 Important directories

- [`backend/src/routes`](./backend/src/routes) — API routes and ingestion endpoints.
- [`backend/src/services`](./backend/src/services) — analytics, realtime streaming, ingestion, and workspace logic.
- [`backend/src/db`](./backend/src/db) — SQLite setup, schema, and migrations.
- [`sdk/src`](./sdk/src) — SDK client, transport, batching, and runtime state.
- [`frontend/src/pages`](./frontend/src/pages) — dashboard pages and analytics views.
- [`frontend/src/components`](./frontend/src/components) — reusable UI and realtime dashboard components.

 ## Operations & maintenance (short)

 - Health endpoint: `GET /api/health` — returns DB sizes and operational counters (active SSE connections, simulators).
 - Backups: `node dist/scripts/backup.js` (uses SQLite online backup API). Backups saved to `backend/data/backups`.
 - Retention: `dist/scripts/retention.js` is dry-run by default. Use `TELEMETRY_RETENTION_APPLY=true` to delete.

## 📚 Next reading

- 🏗️ [Architecture Guide](./ARCHITECTURE.md) — runtime flow, ingest pipeline, SSE, and scaling tradeoffs.
- 🚀 [Deployment Guide](./DEPLOYMENT.md) — production setup, environment variables, backups, and retention.
- 🛠️ [Operations Guide](./OPS.md) — monitoring, maintenance, health checks, and operational workflows.
- 📦 [SDK Documentation](./sdk/README.md) — installation, examples, batching, retries, and production usage.

 ## Contributing

 - Use `NODE_ENV=production` and a strong `JWT_SECRET` for non-local deployments.
 - Keep workspace API keys secret and server-side; do not embed them in browser shipping code.

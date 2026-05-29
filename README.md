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

## Need credentials?

- Workspace ID
	- Dashboard → Sidebar → Copy Workspace ID
- API Key
	- Dashboard → Settings → API Keys
- apiUrl
	- Local: [http://localhost:3001](http://localhost:3001)
	- Hosted: your deployed backend URL

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

### Expected Result

- ✓ Overview page updates
- ✓ Recent Activity shows a new row
- ✓ Endpoint appears in analytics
- ✓ Stream status shows connected

## Why flush() matters

> **Warning:** Telemetry is batched. Short-lived scripts and serverless functions may exit before queued events are delivered.

Always call:

```js
await TokenWatch.flush();
```

before shutdown.

## Troubleshooting

- No data appearing?
	1. Is backend running?
	2. Is `apiUrl` correct?
	3. Is `workspaceId` correct?
	4. Is API key valid?
	5. Did you call `flush()`?
	6. Are filters cleared?

- If events appear in the API but not the dashboard, verify the workspace selection in the sidebar and refresh the page.
- If the realtime stream disconnects, SSE reconnects automatically; localhost restarts can temporarily disconnect the stream.

## Deployment

See [Deployment Guide](./DEPLOYMENT.md) for local development commands, hosted deployment checklists, backups, and retention guidance.

### Frontend Deployment

The frontend should point at the backend API URL, which then reads and writes SQLite.

- Local frontend example: use `http://localhost:3001` for the backend.
- Production frontend example: use your deployed backend URL.
- SSE endpoint requirement: `/api/telemetry/stream` must remain reachable for realtime dashboard updates.
- Reverse proxy consideration: avoid buffering SSE responses and preserve long-lived connections.

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

 # TokenWatch — local telemetry for LLM-powered services

 ⚡ TokenWatch captures LLM request telemetry (route, model, tokens, latency, cost, errors) and provides a lightweight dashboard for realtime visibility.

 This repository contains three main parts:
 - `backend/` — TypeScript Express API, authentication, ingest pipeline, analytics, and SSE streaming backed by SQLite (better-sqlite3).
 - `frontend/` — React + Vite dashboard for workspace-level analytics, request logs and realtime updates.
 - `sdk/` — Small, dependency‑free TypeScript SDK that batches and delivers telemetry to the ingest API.

 The README below is a concise developer guide: quick start, core concepts, and where to look for implementation details.

 ## Why use TokenWatch

 - Quick to run locally or as a single-node beta service.
 - Workspace-scoped telemetry via API keys (`X-API-Key`) so clients cannot write into other workspaces.
 - Realtime updates with Server‑Sent Events (SSE) for live dashboards.
 - Simple, auditable pipeline that is easy to inspect and extend.

 ## Quick start — 3 steps (gets you live)

 1) Start the backend

 ```bash
 cd backend
 npm install
 npm run build
 NODE_ENV=development npm run dev
 ```

 2) Start the frontend

 ```bash
 cd frontend
 npm install
 npm run dev
 ```

 3) Send telemetry from an app using the SDK

 ```js
 import * as TokenWatch from 'tokenwatch';

 TokenWatch.init({ apiUrl: 'http://localhost:3001', workspaceId: 'ws_xxx', apiKey: 'tw_live_xxx' });
 await TokenWatch.track('llm.request.completed', { route: '/api/chat', provider: 'openai', model: 'gpt-4o' });
 await TokenWatch.flush();
 ```

 This flow demonstrates the product story: Install SDK → send telemetry → see live analytics.

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

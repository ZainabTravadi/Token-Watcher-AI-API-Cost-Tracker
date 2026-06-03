 # Architecture (TokenWatch)

 This document describes the actual runtime architecture, the implemented flow, and the engineering tradeoffs made for a single-node beta deployment.

 ## System overview

 - SDK: dependency‑free TypeScript client that buffers events in a bounded queue, groups them into batches, and delivers to the ingest API with retries and graceful shutdown support. See `sdk/src/transport.ts` and `sdk/src/client.ts`.
 - Backend API: Express application that exposes auth, workspace management, analytics, requests, and ingest endpoints. Key services live in `backend/src/services`.
 - Storage: single PostgreSQL database. Schema and initialization are in `backend/src/db`.
 - Realtime: lightweight fanout using an in‑process `telemetryBus` EventEmitter and Server‑Sent Events (SSE) per workspace (`realtimeStreamService`).
 - Frontend: React dashboard (Vite) that authorizes users, selects a workspace, opens an SSE connection to `/api/telemetry/stream`, and refreshes analytics views via React Query.

 ## End-to-end flow

 1. App code calls `TokenWatch.track(...)` (or equivalent). The SDK enqueues the record.
 2. The SDK groups records and issues POSTs to `POST /api/ingest` (includes `X-API-Key`).
 3. `authenticateSDK` validates the API key and attaches `req.workspaceId`.
 4. `ingestService` validates/normalizes payloads and writes one or more rows into the `requests` table (single transaction for batches).
 5. For each inserted row the service emits a `telemetry` event on `telemetryBus` and invalidates analytics caches for that workspace.
 6. `realtimeStreamService` forwards `telemetry` events to connected SSE clients that requested that workspace (workspace-scoped subscriptions).
 7. Frontend SSE handler receives rows and triggers selective query invalidation (React Query) so charts, lists and counters refresh with low latency.

 ## Workspace isolation & auth

 - Ingest is authenticated using `X-API-Key`. Keys are stored and validated server-side; a successful key resolves a workspace and `req.workspaceId`.
 - Dashboard sessions use JWT cookies for user authentication; `requireOwnedWorkspace` middleware enforces that API responses are scoped to the authenticated user's workspace.

 ## Realtime model

 - We use SSE for one-way server→client updates. Each SSE connection is tied to a workspace and receives only that workspace's events.
 - `telemetryBus` provides a simple in-memory fanout. This design is straightforward, low-latency, and easy to inspect in single-node setups.

 ## Why PostgreSQL (tradeoffs)

 - Reason: managed durability, strong consistency, and compatibility with Neon/Heroku for production deployments.
 - Tradeoffs: a single-node Postgres deployment still requires monitoring and backups. For higher ingest volume or multi-instance scaling, add a queue/pubsub layer and consider a dedicated analytics store.

 ## Safety & rate limiting

 - The ingest route applies a lightweight per-IP burst limiter to guard against accidental floods. This is a safety layer, not a replacement for API gateways, WAFs or upstream rate limiting.

 ## Scaling path

 1. Keep SDK and ingest API as-is; introduce a queue (Rabbit/Kafka/SQS) ahead of the DB.
 2. Move persistent storage to Postgres or a columnar/OLAP store for analytics and long-term retention.
 3. Replace `telemetryBus` with a pub/sub system (Redis Streams, NATS) for multi-instance fanout and scalable SSE delivery.


# Architecture (TokenWatch)

This document explains the implemented architecture and the engineering tradeoffs behind TokenWatch. It describes actual runtime components and data flow.

## Components

- SDK (client): in-memory bounded queue, batch flush timer, request grouping, retry policy, graceful shutdown hook. Source: `sdk/src/`.
- Backend API: Express server exposing auth, workspace management, analytics, and ingest endpoints. Source: `backend/src/`.
- Storage: SQLite (better-sqlite3) in WAL mode. Schema defined in `backend/src/db/schema.ts` and applied in `backend/src/db/database.ts`.
- Realtime: Server-Sent Events (SSE) implemented in `backend/src/services/realtimeStreamService.ts` with a `telemetryBus` EventEmitter as fanout.
- Frontend: React dashboard uses `AuthContext` and `StatusContext` to manage session, workspace selection, health polling and SSE reconnection. Source: `frontend/src/`.

## Data flow

1. SDK `track()` enqueues events into the local queue. The transport groups queued events and POSTs to `POST /api/ingest`.
2. `authenticateSDK` middleware validates `X-API-Key`, resolves the workspace and attaches `req.workspaceId`.
3. `ingestService` validates and normalizes records, writes to `requests` table (single-row or batch transaction), emits `telemetry` events via `telemetryBus`, and invalidates analytics cache.
4. SSE clients subscribed per workspace receive `telemetry` events filtered by workspace id by `realtimeStreamService` and trigger UI refreshes.

## Why these choices (tradeoffs)

- SQLite (WAL): simple, zero-ops storage suitable for single-node beta deployments; low operational overhead. Not intended for high write-per-second workloads.
- SSE vs WebSocket: SSE is simpler to implement and sufficient for one-way server-to-client telemetry updates; easy to scale for the dashboard's expected client counts.
- SDK batching & retry: reduces per-event overhead and smooths traffic to the ingest endpoint, protecting the single-node DB from bursts.
- In-memory rate limiting on ingest: quick protection against accidental DoS or massive client misconfiguration; not a replacement for a production API gateway.

## Limits and scaling path

- Current practical scale: tens to low hundreds of events/sec depending on hardware, batch sizes and disk speed.
- If you need higher scale: move ingest to a horizontally scalable service (Node + PostgreSQL / a queue), partition ingests, or add a message queue in front of the DB.

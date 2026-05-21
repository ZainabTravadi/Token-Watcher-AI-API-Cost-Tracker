# Operational Notes

Practical guidance for running TokenWatch in a single-node beta environment.

## Health checks
- `GET /api/health` returns DB connectivity, `dbFiles` (`fileSizeBytes`, `walSizeBytes`) and `operational` counters (`activeSseConnections`, `activeSimulators`). Use these in monitoring.

## Backups
- Use `node dist/scripts/backup.js` from `backend` to produce a consistent SQLite snapshot (saved to `backend/data/backups` by default). Copy backups to durable storage.

## Retention
- Use `dist/scripts/retention.js` with `TELEMETRY_RETENTION_DAYS` to dry-run deletions. Add `TELEMETRY_RETENTION_APPLY=true` to apply deletions.
- Retention runs are batched and yield to the event loop between batches to avoid long locks.

## Simulator behavior
- Workspace simulators (`workspaceSimulatorManager`) seed an initial batch and then generate periodic ingest calls (2–5s random interval). They create or rotate API keys as needed.
- Global `simulatorService` currently seeds demo data on startup; it does not run a persistent generator.

## Practical ops checklist
- Ensure `JWT_SECRET` is set in production.
- Monitor `/api/health` for WAL growth. If WAL grows unexpectedly, run a checkpoint or ensure backups run.
- If ingest `429` rate limits are observed, tune client batching or increase capacity / throttle upstream sources.

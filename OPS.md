 # Operational notes

 Short operational checklist and troubleshooting tips.

## Frontend / Backend / SQLite flow

The frontend talks to the backend API, and the backend reads and writes SQLite.

- Frontend should use the deployed backend URL in production.
- Local frontend can use `http://localhost:3001` for the backend.
- Keep SSE reachable at `/api/telemetry/stream` so realtime updates can flow back to the dashboard.
- If a reverse proxy is in front of the backend, make sure it does not buffer or terminate the SSE stream.

## Common Production Problems

- SSE disconnects: the stream reconnects automatically, but proxy timeouts or localhost restarts can interrupt it temporarily.
- Wrong backend URL: the frontend will appear healthy but telemetry will never reach the backend.
- Invalid API keys: ingestion requests will fail authorization and events will not be stored.
- Empty dashboard: check the workspace selection and confirm data is being written to the expected workspace.
- CORS issues: ensure the frontend origin is allowed by the backend deployment.
- Backend unavailable: verify the backend service is running and reachable from the frontend.

 ## Health & monitoring

 - Health endpoint: `GET /api/health` — inspect `dbFiles.fileSizeBytes`, `dbFiles.walSizeBytes`, and `operational` counters (`activeSseConnections`, `activeSimulators`).
 - Export these metrics to your monitoring system for alerting on WAL growth or connection spikes.

 ## Backups & retention

 - Backups: `node dist/scripts/backup.js` (creates consistent snapshot saved to `backend/data/backups`). Copy snapshots to durable storage.
 - Retention: use `dist/scripts/retention.js` with `TELEMETRY_RETENTION_DAYS`. The script is dry-run by default; use `TELEMETRY_RETENTION_APPLY=true` to apply deletions.

 ## SSE & realtime

 - SSE is one-way (server → client). Monitor the number of active connections; ensure load balancers have sensible timeouts and support for long‑lived connections.

 ## WAL considerations

 - WAL can grow if checkpoints/backup do not run. Regular backups and occasional checkpoints keep WAL sizes bounded.

 ## Troubleshooting

 - `429` from `/api/ingest` — indicates client burst limits; tune client batching or spread load.
 - Unexpected WAL growth — ensure backups/checkpoints run and disk I/O is healthy.


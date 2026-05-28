 # Operational notes

 Short operational checklist and troubleshooting tips.

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


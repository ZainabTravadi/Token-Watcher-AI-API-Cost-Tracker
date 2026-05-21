# Deployment & Operations Notes (TokenWatch)

This document provides concise, practical instructions for deploying and operating TokenWatch for beta/single-node use.

## Environment
- Copy `.env.example` to `.env` and adjust values.
- **In production** set `NODE_ENV=production` and set a secure `JWT_SECRET` (32+ chars).
- By default simulators are disabled in production. To explicitly enable, set `ENABLE_SIMULATORS=true` (not recommended for public deployments).

## Recommended env vars
- `NODE_ENV=production`
- `PORT=3001`
- `DATABASE_PATH=./data/tokenwatch.sqlite`
- `JWT_SECRET=<strong-secret-32+chars>`
- Optional: `TELEMETRY_RETENTION_DAYS=30` and `TELEMETRY_RETENTION_APPLY=true` for retention runs.

## Startup
1. Install deps:

```bash
cd backend
npm install
npm run build
```

2. Start (production):

```bash
NODE_ENV=production JWT_SECRET="<secret>" node dist/main.js
```

3. Health: `GET /health` exposes DB sizes and operational counters.

## Backups
- Create a timestamped local backup:

```bash
cd backend
node dist/scripts/backup.js
```

- Backups are saved to `backend/data/backups` by default.
- Copy backups off the instance to durable storage for production.

Example cron (daily at 03:00) to run backup and copy to S3 (simple example):

```bash
# /etc/cron.d/tokenwatch-backup
0 3 * * * cd /srv/tokenwatch/backend && /usr/bin/node dist/scripts/backup.js && aws s3 cp data/backups/ s3://my-bucket/tokenwatch-backups/ --recursive --exclude "*latest*"
```

## Retention
- Retention is opt-in and safe by default (dry-run):

```bash
cd backend
TELEMETRY_RETENTION_DAYS=30 node dist/scripts/retention.js     # dry-run: shows how many rows would be deleted
TELEMETRY_RETENTION_DAYS=30 TELEMETRY_RETENTION_APPLY=true node dist/scripts/retention.js  # apply deletions
```

- Recommendation: run retention daily or weekly via cron/systemd.
- Retention deletes are batched to avoid long locks.

Example cron (weekly retention dry-run):

```bash
# Dry-run weekly: logs how many rows would be deleted
0 4 * * 0 cd /srv/tokenwatch/backend && TELEMETRY_RETENTION_DAYS=90 node dist/scripts/retention.js >> /var/log/tokenwatch/retention-dryrun.log 2>&1

# Apply deletions monthly (careful):
0 5 1 * * cd /srv/tokenwatch/backend && TELEMETRY_RETENTION_DAYS=90 TELEMETRY_RETENTION_APPLY=true node dist/scripts/retention.js >> /var/log/tokenwatch/retention-apply.log 2>&1
```

## Rate limiting & safety
- The ingest API enforces a per-IP burst limit to protect SQLite from write storms.
- Keep batch sizes reasonable (5-20 events).

## Simulator behavior
- Simulators are enabled by default in development and disabled in production unless `ENABLE_SIMULATORS=true`.
- Workspace simulators only start when a workspace is created or when explicitly started by operator.

## Operational limits (practical guidance)
- TokenWatch is suitable for beta & early production on a single node.
- Expect safe ingest rates of tens to low hundreds of events/sec depending on batch sizes and disk.
- For higher scale consider moving ingest to a service backed by Postgres or scalable queueing.

## Troubleshooting
- Check `/health` for `dbFiles.fileSizeBytes`, `dbFiles.walSizeBytes`, `operational.activeSseConnections` and `operational.activeSimulators`.
- If WAL grows large, run a checkpoint manually or ensure backups/checkpoints run regularly.


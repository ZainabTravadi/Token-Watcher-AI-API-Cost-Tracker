# Deployment & Production checklist

Short, practical deployment notes for a single-node TokenWatch instance.

## Local Development

- Backend: [http://localhost:3001](http://localhost:3001)
- Frontend: [http://localhost:5173](http://localhost:5173)
- SDK: points to the backend URL you are running locally

### Bash

```bash
cd backend
npm install
npm run dev

cd ../frontend
npm install
npm run dev
```

### PowerShell

```powershell
Set-Location backend
npm install
npm run dev

Set-Location ..\frontend
npm install
npm run dev
```

 ## Environment

 - Copy `.env.example` → `.env` and set values for production.
 - Required in production: `NODE_ENV=production`, `JWT_SECRET` (strong, 32+ chars).
 - Recommended vars:
	 - `PORT` (default 3001)
	 - `DATABASE_PATH` (default ./data/tokenwatch.sqlite)
	 - `TELEMETRY_RETENTION_DAYS` (optional)

## Hosted Deployment Checklist

- backend deployed
- frontend deployed
- `VITE_TOKENWATCH_API_URL` configured
- JWT secret configured
- backups configured
- retention policy configured

 ## Start (production)

 ```bash
 cd backend
 npm ci
 npm run build
 NODE_ENV=production JWT_SECRET="<secret>" node dist/main.js
 ```

 Health endpoint: `GET /api/health` — reports DB file sizes and operational counters (active SSE connections, simulators).

 ## Backups

 - Create a consistent SQLite snapshot:

 ```bash
 cd backend
 node dist/scripts/backup.js
 ```

 - Backups are saved to `backend/data/backups` by default — copy them to durable storage.

 ## Retention

 - Dry-run:

 ```bash
 TELEMETRY_RETENTION_DAYS=30 node dist/scripts/retention.js
 ```

 - Apply deletions (EXTRA CARE):

 ```bash
 TELEMETRY_RETENTION_DAYS=30 TELEMETRY_RETENTION_APPLY=true node dist/scripts/retention.js
 ```

 Run retention during off-peak windows; retention is batched to avoid long locks.

 ## Operational notes

 - The ingest API has a per‑IP burst limiter for safety; tune client batching (`batchSize`, `flushInterval`) rather than disabling safeguards.
 - Simulators: disabled in production by default. Enable via `ENABLE_SIMULATORS=true` only for controlled environments.

 ## When to scale beyond SQLite

 - If sustained write traffic or analytic needs grow beyond single-node capabilities, introduce a queue and move storage to Postgres or a managed analytics store.



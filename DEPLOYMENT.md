# Deployment & Production checklist

Short, practical deployment notes for a single-node TokenWatch instance.

## Frontend Deployment Flow

Frontend → Backend API → PostgreSQL.

- The frontend should point to the backend API URL.
- Local frontend example: use the local backend URL at [http://localhost:3001](http://localhost:3001).
- Production frontend example: use your deployed backend URL.
- SSE endpoint requirements: the backend must expose `/api/telemetry/stream` and keep the connection open for workspace-scoped realtime updates.
- Reverse proxy considerations: preserve SSE streaming headers, avoid buffering, and allow long-lived connections through your proxy or load balancer.

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

## Hosted Deployment Walkthrough

### Backend

- Set `NODE_ENV=production`.
- Set a strong `JWT_SECRET`.
- Set `DATABASE_URL` to your production Postgres connection string (Neon/Heroku Postgres).
- Store API keys server-side and keep them out of the browser bundle.

### Frontend

- Build the frontend for production.
- Set `VITE_TOKENWATCH_API_URL` to your deployed backend URL.
- Deploy the frontend separately from the backend if needed.

 ## Environment

 - Copy `.env.example` → `.env` and set values for production.
 - Required in production: `NODE_ENV=production`, `JWT_SECRET` (strong, 32+ chars), `DATABASE_URL`.
 - Recommended vars:
	 - `PORT` (default 3001)
	 - `TELEMETRY_RETENTION_DAYS` (optional)

## Hosted Deployment Checklist

- backend deployed
- frontend deployed
- `VITE_TOKENWATCH_API_URL` configured
- JWT secret configured
- backups configured
- retention policy configured

## Production Verification

After deployment verify:

- Login works
- Workspace visible
- API key creation works
- SDK can ingest events
- Dashboard receives data
- SSE stream connected

 ## Start (production)

 ```bash
 cd backend
 npm ci
 npm run build
 NODE_ENV=production JWT_SECRET="<secret>" node dist/main.js
 ```

 Health endpoint: `GET /api/health` — reports database connection status and operational counters (active SSE connections, simulators).

 ## Backups

 - Create a consistent PostgreSQL snapshot using the backup helper:

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

 ## When to scale beyond the current architecture

 - If sustained write traffic or analytic needs grow beyond single-node capabilities, introduce a queue and consider a more scalable Postgres deployment or a managed analytics store.



# Deployment

TokenWatch deploys as three runtime services plus one database:

▪️ frontend
▪️ backend
▪️ OpenClaw
▪️ PostgreSQL

## Table Of Contents

- [Frontend](#frontend)
- [Backend](#backend)
- [OpenClaw](#openclaw)
- [Database](#database)
- [Environment Variables](#environment-variables)
- [Production Checklist](#production-checklist)
- [Docker Status](#docker-status)

## Frontend

The dashboard is a static Vite app.

Recommended deployment shape:

▪️ set `VITE_TOKENWATCH_API_URL` to the backend URL
▪️ run `npm run build`
▪️ deploy the generated static assets
▪️ keep `/api/telemetry/stream` reachable from the browser

The repo includes a `frontend/vercel.json` rewrite for SPA routing.

## Backend

The backend is an Express process.

Deployment notes:

▪️ use the backend `Procfile`
▪️ run the release step with `npm run db:init`
▪️ start the web process with `npm start`
▪️ set `NODE_ENV=production`
▪️ set a strong `JWT_SECRET`
▪️ set `DATABASE_URL` to PostgreSQL
▪️ set `CORS_ORIGIN` to the dashboard origin

## OpenClaw

OpenClaw is a separate Node process.

Deployment notes:

▪️ set `TOKENWATCHER_API_URL`
▪️ set `OPENCLAW_INTERNAL_SECRET`
▪️ set `OPENCLAW_PORT` and `OPENCLAW_HOST`
▪️ keep Telegram API credentials out of application code
▪️ do not store customer bot tokens in the environment

## Database

TokenWatch uses PostgreSQL only.

Deployment notes:

▪️ provision a managed PostgreSQL instance
▪️ set `DATABASE_URL`
▪️ make sure the database is reachable from the backend runtime
▪️ keep backups enabled
▪️ validate schema initialization on first release

## Environment Variables

| Component | Variables |
|---|---|
| Backend | `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `TOKENWATCHER_SECRET_ENCRYPTION_KEY`, `OPENCLAW_INTERNAL_SECRET`, `OPENCLAW_PUBLIC_URL`, `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TOKENWATCH_REQUIRE_SIGNED_INGEST`, `TOKENWATCH_INGEST_SIGNATURE_TOLERANCE_MS` |
| Frontend | `VITE_TOKENWATCH_API_URL` |
| OpenClaw | `TOKENWATCHER_API_URL`, `OPENCLAW_INTERNAL_SECRET`, `OPENCLAW_PORT`, `OPENCLAW_HOST`, `TOKENWATCHER_TIMEOUT_MS`, `TOKENWATCHER_USER_AGENT`, `OPENCLAW_TELEGRAM_API_URL` |

Full validation rules live in [`security.md`](security.md).

## Production Checklist

▪️ backend deployed and healthy
▪️ frontend deployed and pointed at the backend
▪️ database provisioned and backed up
▪️ OpenClaw deployed with the shared internal secret
▪️ Telegram integration tested from BotFather to dashboard
▪️ API keys created and rotated successfully
▪️ SSE stream connected in the dashboard
▪️ health endpoint returns OK

## Docker Status

No official Docker or Compose workflow is committed yet.
If you standardize on containers later, document the backend, frontend, OpenClaw, and database services here.

## Related Docs

▪️ [`project-structure.md`](project-structure.md)
▪️ [`operations.md`](operations.md)
▪️ [`security.md`](security.md)

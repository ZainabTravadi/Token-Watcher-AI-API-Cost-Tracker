# Project Structure

This file explains the major folders in the repository and what each one owns.

## Table Of Contents

- [Top-Level Folders](#top-level-folders)
- [Backend](#backend)
- [Frontend](#frontend)
- [SDK](#sdk)
- [OpenClaw](#openclaw)
- [Docs](#docs)
- [Database](#database)

## Top-Level Folders

| Folder | Responsibility |
|---|---|
| `backend/` | API, authentication, analytics, ingest, storage, and notifications |
| `frontend/` | Dashboard, settings, docs page, charts, and SSE client |
| `sdk/` | Published telemetry SDK |
| `openclaw/` | Telegram bridge and intent router |
| `docs/` | Canonical repository documentation |

## Backend

The backend owns:

▪️ request ingestion
▪️ workspace and API-key management
▪️ analytics aggregation
▪️ reports, forecasts, and recommendations
▪️ Telegram integration resolution
▪️ operational health endpoints

## Frontend

The frontend owns:

▪️ user sign-in and workspace selection
▪️ dashboard charts and tables
▪️ settings management
▪️ realtime SSE subscription
▪️ the in-app getting-started docs page

## SDK

The SDK owns:

▪️ telemetry buffering
▪️ batching
▪️ retries
▪️ graceful flush and shutdown
▪️ workspace identity resolution

## OpenClaw

OpenClaw owns:

▪️ Telegram webhook intake
▪️ intent routing
▪️ request translation into TokenWatch API calls
▪️ message rendering back to Telegram

## Docs

The docs folder now contains the canonical long-form guides.
Use it first when you need architecture, API, deployment, or contributor context.

## Database

There is no standalone `database/` folder in the repo.
Database ownership lives in `backend/src/db`, where schema definitions and startup schema updates are maintained.

## Related Docs

▪️ [`backend.md`](backend.md)
▪️ [`frontend.md`](frontend.md)
▪️ [`sdk.md`](sdk.md)
▪️ [`openclaw.md`](openclaw.md)
▪️ [`database.md`](database.md)

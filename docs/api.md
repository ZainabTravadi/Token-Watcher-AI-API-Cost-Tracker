# API

This is the public backend surface for TokenWatch.
Unless noted otherwise, workspace-scoped routes require either dashboard cookie auth or a workspace-capable API key.

## Table Of Contents

- [Shared Conventions](#shared-conventions)
- [Health And Identity](#health-and-identity)
- [Authentication](#authentication)
- [Workspaces](#workspaces)
- [Ingest And Requests](#ingest-and-requests)
- [Telemetry](#telemetry)
- [Analytics](#analytics)
- [AI, Intelligence, Forecasts, Reports, And Copilot](#ai-intelligence-forecasts-reports-and-copilot)
- [Telegram Integration](#telegram-integration)

## Shared Conventions

▪️ most JSON responses return `{ data: ... }`
▪️ auth failures are usually `401` or `403`
▪️ validation failures are usually `400`
▪️ rate limits return `429`
▪️ internal failures return `500` or `502`

## Health And Identity

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| GET | `/api/health` | none | Backend health and diagnostics | none | status, version, environment, DB state, SSE counts | `500` if diagnostics fail | `curl /api/health` |
| GET | `/api/me` | cookie or API key | Resolve the current dashboard user or API-key identity | none | identity payload with user, workspace, or key details | `401`, `404`, `500` | `curl /api/me` |

## Authentication

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/signup` | none | Create a user and default workspace | `{ email, password }` | user, workspace, session, fresh API key | `400`, `409`, `429`, `500` | `POST /api/auth/signup` |
| POST | `/api/auth/login` | none | Sign in a user | `{ email, password }` | user, workspaces, session | `400`, `401`, `429`, `500` | `POST /api/auth/login` |
| POST | `/api/auth/logout` | cookie | Clear the session cookie | none | `{ ok: true }` | `401`, `500` | `POST /api/auth/logout` |
| GET | `/api/auth/me` | cookie | Load the current authenticated dashboard user | none | user, workspaces, session | `401`, `404`, `500` | `GET /api/auth/me` |

## Workspaces

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| POST | `/api/workspaces` | cookie | Create a new workspace | `{ name }` | workspace plus API key metadata | `400`, `500` | `POST /api/workspaces` |
| GET | `/api/workspaces` | cookie | List the current user’s workspaces | none | workspace array | `500` | `GET /api/workspaces` |
| GET | `/api/workspaces/current` | cookie or API key with `workspace:read` | Resolve the active workspace | none | workspace object | `400`, `403`, `404`, `500` | `GET /api/workspaces/current` |
| GET | `/api/workspaces/:id` | cookie | Load one workspace owned by the user | path `id` | workspace object | `400`, `404`, `500` | `GET /api/workspaces/ws_123` |
| PUT | `/api/workspaces/:id` | cookie | Update workspace name, budget, or webhook URL | `{ name?, monthly_budget?, webhook_url? }` | updated workspace | `400`, `404`, `500` | `PUT /api/workspaces/:id` |
| PUT | `/api/workspaces/:id/settings` | cookie | Update alerts, digests, reports, and notification settings | settings object | settings row | `400`, `404`, `500` | `PUT /api/workspaces/:id/settings` |
| POST | `/api/workspaces/:id/notifications/test-email` | cookie | Send a test email | optional `{ email }` | simulated or delivered email result | `400`, `404`, `502` | `POST /api/workspaces/:id/notifications/test-email` |
| POST | `/api/workspaces/:id/notifications/send-daily-digest` | cookie | Trigger a daily digest manually | none | digest result | `404`, `502` | `POST /api/workspaces/:id/notifications/send-daily-digest` |
| POST | `/api/workspaces/:id/notifications/send-weekly-report` | cookie | Trigger a weekly report manually | none | report result | `404`, `502` | `POST /api/workspaces/:id/notifications/send-weekly-report` |
| GET | `/api/workspaces/:id/usage` | cookie | Return workspace usage summary | none | telemetry count, current spend, api version, SDK version | `404`, `500` | `GET /api/workspaces/:id/usage` |
| POST | `/api/workspaces/:id/webhook/test` | cookie | Test a workspace webhook URL | optional `{ url }` | webhook test result | `400`, `404`, `500` | `POST /api/workspaces/:id/webhook/test` |
| POST | `/api/workspaces/:id/api-keys/regenerate` | cookie | Rotate the default workspace API key | `{ confirmation }` | new API key and metadata | `400`, `404`, `500` | `POST /api/workspaces/:id/api-keys/regenerate` |
| GET | `/api/workspaces/:id/api-keys` | cookie | List workspace API keys | none | API key list | `404`, `500` | `GET /api/workspaces/:id/api-keys` |
| POST | `/api/workspaces/:id/api-keys` | cookie | Create a workspace API key | `{ label?, type?, permissions?, expires_at? }` | plaintext key plus metadata | `400`, `404`, `500` | `POST /api/workspaces/:id/api-keys` |
| POST | `/api/workspaces/:id/api-keys/:keyId/revoke` | cookie | Revoke a workspace API key | path `keyId` | `{ ok: true }` | `404`, `500` | `POST /api/workspaces/:id/api-keys/:keyId/revoke` |
| DELETE | `/api/workspaces/:id` | cookie | Delete a workspace after confirmation | `{ confirmation }` | `{ ok: true }` | `400`, `404`, `500` | `DELETE /api/workspaces/:id` |

## Ingest And Requests

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| POST | `/api/ingest` | SDK API key | Primary telemetry ingest endpoint | telemetry payload | inserted request rows | `400`, `401`, `429`, `500` | `POST /api/ingest` |
| POST | `/ingest` | SDK API key | Ingest alias for deployments that proxy the root path | telemetry payload | inserted request rows | `400`, `401`, `429`, `500` | `POST /ingest` |
| POST | `/api/requests` | SDK API key | Legacy ingest alias | telemetry payload | inserted request rows | `400`, `401`, `429`, `500` | `POST /api/requests` |
| GET | `/api/requests` | workspace read | Request log search, filters, pagination, and sort | query params | paginated rows plus cursor metadata | `400`, `401`, `403`, `500` | `GET /api/requests?limit=50` |
| GET | `/api/requests/export` | workspace read | CSV, JSON, or PDF request export | query params | downloadable export | `400`, `401`, `403`, `500` | `GET /api/requests/export?format=csv` |

Common request-log filters:

▪️ `page`, `limit`, `cursor`
▪️ `route`, `endpoint`, `provider`, `model`, `status`, `workspace`
▪️ `search`
▪️ `from`, `to`
▪️ `minLatency`, `maxLatency`, `minCost`, `maxCost`, `minTokens`, `maxTokens`
▪️ `sortBy`, `sortDir`

## Telemetry

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| GET | `/api/telemetry` | cookie + owned workspace | Latest telemetry rows for a workspace | `limit` query param | recent rows and simulator state | `400`, `401`, `403`, `500` | `GET /api/telemetry?limit=100` |
| GET | `/api/telemetry/export-pdf` | cookie + owned workspace | Overview export PDF | `from`, `to`, optional filters | PDF download | `400`, `401`, `403`, `500` | `GET /api/telemetry/export-pdf?from=...&to=...` |
| GET | `/api/telemetry/status` | none | Simulator status for debug views | none | simulator status | `500` | `GET /api/telemetry/status` |
| GET | `/api/telemetry/workspace-simulator-status` | cookie + owned workspace | Workspace simulator status | none | simulator state | `400`, `401`, `403`, `500` | `GET /api/telemetry/workspace-simulator-status` |
| GET | `/api/telemetry/stream` | cookie + owned workspace | SSE stream for live dashboard updates | none | event stream | `400`, `401`, `403`, `500` | `GET /api/telemetry/stream` |

## Analytics

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| GET | `/api/analytics/overview` | `analytics:read` | Overview metrics | none | overview metrics | `400`, `401`, `403`, `500` | `GET /api/analytics/overview` |
| GET | `/api/analytics/endpoints` | `analytics:read` | Endpoint aggregates | none | endpoint analytics | `400`, `401`, `403`, `500` | `GET /api/analytics/endpoints` |
| GET | `/api/analytics/models` | `analytics:read` | Model aggregates | none | model analytics | `400`, `401`, `403`, `500` | `GET /api/analytics/models` |
| GET | `/api/analytics/recent` | `analytics:read` | Recent activity feed | none | recent telemetry summary | `400`, `401`, `403`, `500` | `GET /api/analytics/recent` |
| GET | `/api/analytics/timeline` | `analytics:read` | Time-series analytics for charts | none | timeline buckets | `400`, `401`, `403`, `500` | `GET /api/analytics/timeline` |
| GET | `/api/analytics/snapshot` | `analytics:read` | Realtime dashboard snapshot | none | full analytics snapshot | `400`, `401`, `403`, `500` | `GET /api/analytics/snapshot` |
| POST | `/api/ai/insights` | `analytics:read` | Generate AI insights summary | none | insights plus summary | `400`, `401`, `403`, `500` | `POST /api/ai/insights` |

## AI, Intelligence, Forecasts, Reports, And Copilot

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| GET | `/api/intelligence/recommendations` | `recommendations:read` | Optimization recommendations | none | recommendation list | `400`, `401`, `403`, `500` | `GET /api/intelligence/recommendations` |
| GET | `/api/intelligence/efficiency-score` | `recommendations:read` | Efficiency score | none | score payload | `400`, `401`, `403`, `500` | `GET /api/intelligence/efficiency-score` |
| GET | `/api/intelligence/anomalies` | `recommendations:read` | Anomaly detection | none | anomaly list | `400`, `401`, `403`, `500` | `GET /api/intelligence/anomalies` |
| POST | `/api/intelligence/root-cause` | `recommendations:read` | Root-cause analysis for an anomaly | `{ anomaly }` | root-cause analysis | `400`, `401`, `403`, `500` | `POST /api/intelligence/root-cause` |
| GET | `/api/forecast` | `forecast:read` | Full forecast | none | forecast payload | `400`, `401`, `403`, `500` | `GET /api/forecast` |
| GET | `/api/forecast/spend` | `forecast:read` | Spend forecast | none | spend forecast | `400`, `401`, `403`, `500` | `GET /api/forecast/spend` |
| GET | `/api/forecast/requests` | `forecast:read` | Request forecast | none | request forecast | `400`, `401`, `403`, `500` | `GET /api/forecast/requests` |
| GET | `/api/forecast/budget` | `forecast:read` | Budget forecast | none | budget forecast | `400`, `401`, `403`, `500` | `GET /api/forecast/budget` |
| GET | `/api/reports/executive` | `reports:read` | Executive report | none | report payload | `400`, `401`, `403`, `500` | `GET /api/reports/executive` |
| GET | `/api/reports/weekly` | `reports:read` | Weekly report | none | report payload | `400`, `401`, `403`, `500` | `GET /api/reports/weekly` |
| GET | `/api/reports/monthly` | `reports:read` | Monthly report | none | report payload | `400`, `401`, `403`, `500` | `GET /api/reports/monthly` |
| GET | `/api/reports/budget` | `reports:read` | Budget report | none | report payload | `400`, `401`, `403`, `500` | `GET /api/reports/budget` |
| GET | `/api/reports/infrastructure` | `reports:read` | Infrastructure report | none | report payload | `400`, `401`, `403`, `500` | `GET /api/reports/infrastructure` |
| GET | `/api/reports/optimization` | `reports:read` | Optimization report | none | report payload | `400`, `401`, `403`, `500` | `GET /api/reports/optimization` |
| GET | `/api/reports/governance` | `reports:read` | Governance report | none | report payload | `400`, `401`, `403`, `500` | `GET /api/reports/governance` |
| GET | `/api/reports/export` | `reports:read` | Export a report as a file | `type`, `format` | downloadable file | `400`, `401`, `403`, `500` | `GET /api/reports/export?type=executive&format=pdf` |
| POST | `/api/copilot/chat` | `copilot:use` | Copilot chat completion | `{ message, role? }` | answer payload | `400`, `401`, `403`, `500` | `POST /api/copilot/chat` |
| POST | `/api/copilot/stream` | `copilot:use` | SSE Copilot response | `{ message, role? }` | SSE token stream | `400`, `401`, `403`, `500` | `POST /api/copilot/stream` |
| POST | `/api/copilot/report` | `copilot:use` | Copilot-generated report | `{ type, ... }` | report payload | `400`, `401`, `403`, `500` | `POST /api/copilot/report` |
| POST | `/api/copilot/explain` | `copilot:use` | Copilot explanation for an anomaly | `{ anomaly?, ... }` | explanation payload | `400`, `401`, `403`, `500` | `POST /api/copilot/explain` |
| POST | `/api/copilot/forecast` | `copilot:use` | Copilot forecast helper | request body | forecast payload | `400`, `401`, `403`, `500` | `POST /api/copilot/forecast` |

## Telegram Integration

| Method | Route | Auth | Purpose | Inputs | Response | Errors | Example |
|---|---|---|---|---|---|---|---|
| POST | `/api/integrations/telegram/verify` | cookie | Verify a BotFather token | `{ workspaceId, botToken }` | bot metadata | `400`, `401`, `404`, `429` | `POST /api/integrations/telegram/verify` |
| POST | `/api/integrations/telegram/connect` | cookie | Connect a Telegram bot to a workspace | `{ workspaceId, botToken, webhookBaseUrl? }` | integration record | `400`, `401`, `404`, `429` | `POST /api/integrations/telegram/connect` |
| POST | `/api/integrations/telegram/test` | cookie | Send a test Telegram message | `{ workspaceId }` | delivery result | `400`, `401`, `404`, `429` | `POST /api/integrations/telegram/test` |
| GET | `/api/integrations/telegram/status` | cookie | Load Telegram integration status | `{ workspaceId }` | integration status | `500` | `GET /api/integrations/telegram/status` |
| POST | `/api/integrations/telegram/regenerate-openclaw-key` | cookie | Rotate the OpenClaw key used by Telegram | `{ workspaceId }` | refreshed integration record | `400`, `401`, `404`, `429` | `POST /api/integrations/telegram/regenerate-openclaw-key` |
| DELETE | `/api/integrations/telegram` | cookie | Disconnect Telegram from a workspace | `{ workspaceId }` | `{ ok: true }` | `401`, `404`, `500` | `DELETE /api/integrations/telegram` |
| POST | `/api/integrations/telegram/webhook` | internal secret | OpenClaw callback used to resolve a Telegram update | `{ integrationId, telegramSecret?, chatId?, telegramUserId? }` | resolved context | `400`, `403`, `500` | `POST /api/integrations/telegram/webhook` |

## Related Docs

▪️ [`backend.md`](backend.md)
▪️ [`database.md`](database.md)
▪️ [`openclaw.md`](openclaw.md)
▪️ [`telegram.md`](telegram.md)

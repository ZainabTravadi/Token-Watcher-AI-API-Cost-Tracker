# API

All backend routes are registered in `backend/src/routes/index.ts`. Most analytics-style endpoints return `{ data }`; auth/workspace endpoints often return raw objects.

## Endpoint Map

| Method/Route | Auth | Owner | Consumers |
|---|---|---|---|
| `GET /health`, `/api/health` | none | `routes/health.ts` | frontend status |
| `POST /api/auth/signup` | none | `routes/auth.ts`, `authService.ts` | signup page |
| `POST /api/auth/login` | none | `routes/auth.ts`, `authService.ts` | login page |
| `POST /api/auth/logout` | cookie | `routes/auth.ts` | AuthContext |
| `GET /api/auth/me` | cookie | `routes/auth.ts` | AuthContext bootstrap |
| `GET /api/me` | cookie or API key | `routes/me.ts` | SDK workspace lookup, OpenClaw |
| `POST /api/workspaces` | cookie | `routes/workspaces.ts`, `authService.ts` | settings/workspace UI |
| `GET /api/workspaces` | cookie | `routes/workspaces.ts` | Auth/settings |
| `GET /api/workspaces/current` | cookie or API key `workspace:read` | `routes/workspaces.ts` | OpenClaw |
| `GET /api/workspaces/:id` | cookie | `routes/workspaces.ts` | settings |
| `PUT /api/workspaces/:id` | cookie | `routes/workspaces.ts`, `authService.ts` | settings name/budget/webhook |
| `PUT /api/workspaces/:id/settings` | cookie | `routes/workspaces.ts`, `authService.ts` | settings sections |
| `POST /api/workspaces/:id/notifications/test-email` | cookie | `routes/workspaces.ts`, `notificationService.ts` | email settings |
| `POST /api/workspaces/:id/notifications/send-daily-digest` | cookie | `routes/workspaces.ts`, `notificationService.ts` | email settings |
| `POST /api/workspaces/:id/notifications/send-weekly-report` | cookie | `routes/workspaces.ts`, `notificationService.ts` | email settings |
| `GET /api/workspaces/:id/usage` | cookie | `routes/workspaces.ts`, `telemetryRepository.ts` | settings usage |
| `POST /api/workspaces/:id/webhook/test` | cookie | `routes/workspaces.ts` | webhook settings |
| `GET /api/workspaces/:id/api-keys` | cookie | `routes/workspaces.ts`, `authService.ts` | API key settings |
| `POST /api/workspaces/:id/api-keys` | cookie | `routes/workspaces.ts`, `authService.ts` | API key settings |
| `POST /api/workspaces/:id/api-keys/regenerate` | cookie | `routes/workspaces.ts`, `authService.ts` | SDK key rotate |
| `POST /api/workspaces/:id/api-keys/:keyId/revoke` | cookie | `routes/workspaces.ts`, `authService.ts` | API key settings |
| `DELETE /api/workspaces/:id` | cookie | `routes/workspaces.ts`, `authService.ts` | danger zone |
| `POST /api/ingest`, `POST /ingest` | API key `telemetry:ingest` | `routes/ingest.ts`, `ingestService.ts` | SDK/direct clients |
| `POST /api/requests` | API key `telemetry:ingest` | `routes/requests.ts`, `ingestService.ts` | SDK/legacy |
| `GET /api/requests` | workspace `requests:read` | `routes/requests.ts`, `telemetryRepository.ts` | requests page, OpenClaw |
| `GET /api/requests/export` | workspace `requests:read` | `routes/requests.ts`, `telemetryRepository.ts` | export UI |
| `GET /api/telemetry` | cookie + owned workspace | `routes/telemetry.ts` | dashboard |
| `GET /api/telemetry/export-pdf` | cookie + owned workspace | `routes/telemetry.ts` | overview export |
| `GET /api/telemetry/status` | none | `routes/telemetry.ts` | status/debug |
| `GET /api/telemetry/workspace-simulator-status` | cookie + owned workspace | `routes/telemetry.ts` | settings/debug |
| `GET /api/telemetry/stream` | cookie + owned workspace | `routes/telemetry.ts`, `realtimeStreamService.ts` | StatusContext |
| `GET /api/analytics/overview` | `analytics:read` | `routes/analytics.ts` | dashboard/OpenClaw |
| `GET /api/analytics/endpoints` | `analytics:read` | `routes/analytics.ts` | dashboard/OpenClaw |
| `GET /api/analytics/models` | `analytics:read` | `routes/analytics.ts` | dashboard/OpenClaw |
| `GET /api/analytics/recent` | `analytics:read` | `routes/analytics.ts` | dashboard/OpenClaw |
| `GET /api/analytics/timeline` | `analytics:read` | `routes/analytics.ts` | dashboard |
| `GET /api/analytics/snapshot` | `analytics:read` | `routes/analytics.ts` | dashboard/OpenClaw |
| `POST /api/ai/insights` | `analytics:read` | `routes/ai.ts` | optional UI |
| `GET /api/intelligence/recommendations` | `recommendations:read` | `routes/intelligence.ts` | analytics/OpenClaw |
| `GET /api/intelligence/efficiency-score` | `recommendations:read` | `routes/intelligence.ts` | analytics |
| `GET /api/intelligence/anomalies` | `recommendations:read` | `routes/intelligence.ts` | AI/copilot |
| `POST /api/intelligence/root-cause` | `recommendations:read` | `routes/intelligence.ts` | AI/copilot |
| `GET /api/reports/:type` | `reports:read` | `routes/reports.ts` | OpenClaw/notifications |
| `GET /api/reports/export` | `reports:read` | `routes/reports.ts` | future UI |
| `GET /api/forecast*` | `forecast:read` | `routes/forecast.ts` | OpenClaw/AI |
| `POST /api/copilot/*` | `copilot:use` | `routes/copilot.ts` | OpenClaw/future UI |

## Common Errors

- `400`: validation failed, workspace ID required, bad payload.
- `401`: missing/invalid cookie, API key, or signed ingest signature.
- `403`: workspace forbidden or API key lacks permission.
- `429`: auth or ingest rate limit.
- `500`: backend failure.
- `502`: notification/email send failure in workspace routes.

## API Rules

- Use `authenticateWorkspaceAccess(permission)` for routes meant for both browser and API-key clients.
- Use `authenticateUser` for browser-only settings/admin routes.
- Ingest routes use `authenticateSDK`.
- Route files parse HTTP details; service files own reusable behavior.

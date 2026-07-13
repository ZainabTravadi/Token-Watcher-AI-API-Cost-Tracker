# Backend

Backend is Express 5 + PostgreSQL. Bootstrap is `backend/src/main.ts` -> `backend/src/core/server.ts` -> `backend/src/core/app.ts` -> `backend/src/routes/index.ts`.

## Route Ownership

| Route file | Owns |
|---|---|
| `routes/auth.ts` | signup, login, logout, browser `/api/auth/me` |
| `routes/me.ts` | unified identity for cookie or API key, used by SDK/OpenClaw |
| `routes/workspaces.ts` | workspace CRUD, settings, notifications, webhook tests, API keys |
| `routes/ingest.ts` | `/api/ingest` and `/ingest`, ingest rate limit |
| `routes/requests.ts` | request log, exports, SDK ingest alias `/api/requests` |
| `routes/telemetry.ts` | latest telemetry, SSE, telemetry PDF export, simulator status |
| `routes/analytics.ts` | overview/endpoints/models/recent/timeline/snapshot |
| `routes/ai.ts` | basic AI insights |
| `routes/intelligence.ts` | recommendations, efficiency, anomalies, root cause |
| `routes/reports.ts` | report endpoints and report export |
| `routes/forecast.ts` | forecast endpoints |
| `routes/copilot.ts` | copilot chat/stream/report/explain/forecast |
| `routes/health.ts` | health diagnostics |

## Service Ownership

| Service | Owns | Risk |
|---|---|---|
| `authService.ts` | users, workspaces, API keys, workspace settings persistence | very high |
| `ingestService.ts` | ingest validation/normalization, cache invalidation, bus emit, alert trigger | high |
| `telemetryRepository.ts` | all `requests` SQL, analytics, request log, exports, dimensions | very high |
| `analyticsService.ts`, `analyticsCache.ts` | cached snapshot facade | medium |
| `realtimeStreamService.ts`, `telemetryBus.ts` | SSE lifecycle and in-process events | high |
| `forecastService.ts` | forecast math/cache | high |
| `reportService.ts` | reports and export formats | high |
| `copilotService.ts` | copilot memory, tool selection, prompts, fallback | high |
| `aiInsightsService.ts`, `geminiService.ts` | Gemini integration and summary | medium-high |
| `recommendationService.ts`, `anomalyService.ts`, `efficiencyScoreService.ts`, `rootCauseService.ts` | intelligence services | medium-high |
| `notificationService.ts` | alerts, digests, scheduler | high |
| `emailService.ts`, `emailTemplates.ts` | Resend transport and HTML emails | medium |
| `simulatorService.ts`, `workspaceSimulatorManager.ts`, `telemetryGenerator.ts` | demo telemetry | low-medium |

## Auth Rules

- Browser users authenticate with JWT cookies.
- SDK/integrations authenticate with API keys.
- API key types: `SDK`, `OPENCLAW`, `CI`, `READONLY`, `ADMIN`, `SERVICE`.
- Permissions include `telemetry:ingest`, `workspace:read`, `analytics:read`, `requests:read`, `reports:read`, `recommendations:read`, `forecast:read`, `copilot:use`, `admin:all`.
- Workspace isolation is mandatory. Every workspace-scoped SQL query must filter by `workspace_id`.
- Never return plaintext API keys except immediately after create/regenerate/signup.

## Middleware

| Function | Purpose |
|---|---|
| `authenticateUser` | JWT cookie auth for human dashboard |
| `authenticateSDK` | API key auth for ingest, requires `telemetry:ingest` and optional signature |
| `requireApiKeyPermission(permission)` | API-key-only permission gate |
| `authenticateWorkspaceAccess(permission)` | cookie or API key access to workspace route |
| `authenticateIdentity` | `/api/me` identity via cookie or API key |
| `requireOwnedWorkspace` | verifies user owns workspace resolved from params/query/body/default |

## Notifications

`notificationService.ts` has three entry types:

- Manual: test email, daily digest, weekly report from `routes/workspaces.ts`.
- Scheduled: `startNotificationScheduler()` every 60 seconds, due by workspace local time fields.
- Ingest-triggered: `evaluateWorkspaceAlerts(workspaceId)` from `ingestService`, async and throttled.

Email transport is `emailService.ts`; HTML is `emailTemplates.ts`; weekly report attachment uses `reportService.exportReport()`.

## AI System

- `geminiService.ts` is the provider gateway.
- `reportService.ts`, `rootCauseService.ts`, and `copilotService.ts` must have deterministic fallback behavior.
- Copilot tools call backend services directly: analytics, recommendations, forecast, efficiency, anomalies, root cause, reports, request search, models, endpoints.
- Copilot conversation state is in memory only.

## Backend Performance Rules

- Keep ingest fast; never await report/AI/email work inside ingest.
- Use repository indexes and workspace filters.
- Avoid unbounded `requests` queries.
- Keep analytics cache invalidation explicit after ingest and workspace changes.
- Notification scheduler should avoid overlapping runs; it already uses `schedulerRunInProgress`.

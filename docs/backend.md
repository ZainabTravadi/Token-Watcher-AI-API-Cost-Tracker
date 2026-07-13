# Backend

The backend is the source of truth for auth, workspace enforcement, telemetry ingest, analytics, reports, forecasts, and Telegram integration resolution.

## Table Of Contents

- [Route Ownership](#route-ownership)
- [Service Ownership](#service-ownership)
- [Auth Model](#auth-model)
- [Operational Rules](#operational-rules)
- [Related Docs](#related-docs)

## Route Ownership

| Route file | Owns |
|---|---|
| `routes/auth.ts` | signup, login, logout, and authenticated dashboard identity |
| `routes/me.ts` | identity resolution for cookie or API-key clients |
| `routes/workspaces.ts` | workspace CRUD, settings, notifications, API keys, webhook tests |
| `routes/ingest.ts` | telemetry ingest and ingest aliases |
| `routes/requests.ts` | request log and exports |
| `routes/telemetry.ts` | latest telemetry, SSE stream, PDF export, simulator status |
| `routes/analytics.ts` | overview, endpoints, models, recent, timeline, snapshot |
| `routes/ai.ts` | AI insights summary |
| `routes/intelligence.ts` | recommendations, efficiency score, anomalies, root cause |
| `routes/reports.ts` | reports and report export |
| `routes/forecast.ts` | forecast endpoints |
| `routes/copilot.ts` | Copilot chat, stream, report, explain, forecast |
| `routes/telegramIntegrations.ts` | Telegram verify, connect, test, status, webhook, disconnect |
| `routes/health.ts` | health diagnostics |

## Service Ownership

| Service | Owns |
|---|---|
| `authService.ts` | users, workspaces, API keys, settings persistence |
| `ingestService.ts` | payload validation, normalization, cache invalidation, SSE emission, alert trigger |
| `telemetryRepository.ts` | all `requests` SQL, analytics aggregation, request filters, dimensions, exports |
| `analyticsService.ts` | analytics snapshot assembly |
| `analyticsCache.ts` | cached analytics lifecycle |
| `realtimeStreamService.ts` | SSE connections |
| `telemetryBus.ts` | in-process telemetry fanout |
| `reportService.ts` | reports and export formats |
| `forecastService.ts` | spend and request forecasting |
| `recommendationService.ts` | optimization recommendations |
| `anomalyService.ts` | anomaly detection |
| `rootCauseService.ts` | anomaly explanation |
| `copilotService.ts` | Copilot prompts, routing, and responses |
| `notificationService.ts` | alerts, digests, reports, scheduler |
| `telegramIntegrationService.ts` | Telegram integration lifecycle |

## Auth Model

▪️ dashboard users authenticate with JWT cookies
▪️ SDK calls authenticate with workspace API keys
▪️ workspace-scoped routes enforce ownership or permission checks
▪️ Telegram integration resolution uses a separate internal secret
▪️ signed ingest can be enabled for stronger backend protection

## Operational Rules

▪️ keep ingest fast
▪️ do not wait on email, reports, or AI work inside the ingest path
▪️ keep all workspace-scoped queries filtered by `workspace_id`
▪️ never return plaintext API keys except at create or rotate time
▪️ keep analytics derived from `requests`
▪️ keep SSE ownership centralized in the status layer

## Related Docs

▪️ [`architecture.md`](architecture.md)
▪️ [`api.md`](api.md)
▪️ [`database.md`](database.md)
▪️ [`security.md`](security.md)

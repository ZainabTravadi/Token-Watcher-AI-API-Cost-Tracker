# Dashboard

The frontend is the TokenWatch dashboard.
It shows workspace telemetry, settings, exports, and live updates over SSE.

## Table Of Contents

- [App Routes](#app-routes)
- [Page Guide](#page-guide)
- [Metric Source Map](#metric-source-map)
- [Realtime Behavior](#realtime-behavior)
- [Settings Panels](#settings-panels)
- [Related Docs](#related-docs)

## App Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | landing page | public entry point |
| `/login` | login | sign in |
| `/signup` | signup | create an account |
| `/app` | overview | workspace summary |
| `/app/requests` | requests | request log and exports |
| `/app/models` | models | model analytics |
| `/app/endpoints` | endpoints | endpoint analytics |
| `/app/settings` | settings | workspace and integration settings |
| `/docs/*` | docs | in-app getting-started docs |

## Page Guide

| Page | Data Sources | What It Shows |
|---|---|---|
| Overview | `/api/analytics/snapshot`, `/api/telemetry`, SSE | spend, throughput, health, budget, top model, top endpoint, recent activity, charts |
| Requests | `/api/requests`, `/api/analytics/snapshot`, SSE | searchable request log, filters, pagination, exports, row detail drawer |
| Models | `/api/analytics/snapshot`, `/api/telemetry` | model spend, token usage, latency, error rate, provider comparison, recommendations |
| Endpoints | `/api/analytics/snapshot`, `/api/telemetry` | endpoint spend, request counts, latency, error rate, recommendations |
| Settings | workspace APIs, Telegram APIs, usage APIs | API keys, Telegram integration, workspace metadata, alerts, email, webhook, usage, security |

## Metric Source Map

Every dashboard metric is derived from a backend source, not from local UI state.

| Metric family | Source |
|---|---|
| Spend, request count, tokens, latency, error rate | `requests` table via `telemetryRepository.ts` |
| Overview charts | analytics snapshot and telemetry rows |
| Recent activity | latest request rows |
| Top models | aggregated `requests` rows grouped by model and provider |
| Top endpoints | aggregated `requests` rows grouped by route |
| Budget remaining | workspace monthly budget minus derived spend |
| API key metadata | `workspaces`, `api_keys`, and `authService.ts` |
| Telegram status | `telegram_integrations` and Telegram API calls |
| Health banner | `/api/health` and `StatusContext` SSE state |
| Forecasts and recommendations | analytics pipeline derived from telemetry |

## Realtime Behavior

▪️ `StatusContext` owns the single dashboard `EventSource`
▪️ the dashboard subscribes to `/api/telemetry/stream`
▪️ new telemetry invalidates analytics, request logs, and health queries
▪️ the request log can be paused without closing the workspace stream

## Settings Panels

The settings page is organized around the following panels:

▪️ API Keys
▪️ Telegram
▪️ Workspace name
▪️ Budget
▪️ Email Notifications
▪️ Alerts
▪️ Webhook
▪️ Usage information
▪️ Security
▪️ Danger zone

The Telegram panel is described in [`telegram.md`](telegram.md).

## Related Docs

▪️ [`architecture.md`](architecture.md)
▪️ [`api.md`](api.md)
▪️ [`operations.md`](operations.md)
▪️ [`project-structure.md`](project-structure.md)

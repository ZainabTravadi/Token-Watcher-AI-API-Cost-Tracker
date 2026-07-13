# Ownership

Use this doc when deciding what to inspect or edit.

## Folder Ownership Score

| Folder/File | Safety | Safe score | Notes |
|---|---|---:|---|
| `frontend/src/components/ui` | safe | 95% | UI primitives only. |
| `frontend/src/components` | safe | 85% | Mostly presentational. |
| `frontend/src/pages` | safe | 80% | Page-local behavior. |
| `backend/src/routes` | safe | 80% | Thin HTTP layer. |
| `openclaw/src/router` | safe | 80% | Intent routing only. |
| `frontend/src/lib/api.ts` | medium | 55% | API/query key ripple. |
| `backend/src/services` | medium | 55% | Business logic. |
| `openclaw/src/tokenwatcher` | medium | 55% | API bridge contracts. |
| `frontend/src/contexts` | cautious | 35% | App-wide state. |
| `telemetryRepository.ts` | dangerous | 20% | SQL/performance hub. |
| `authService.ts` | dangerous | 15% | users/workspaces/API keys. |
| `sdk/src/transport.ts` | dangerous | 15% | all SDK delivery. |
| `backend/src/middleware/auth.ts` | very dangerous | 10% | security boundary. |
| `backend/src/db` | very dangerous | 10% | data/startup-wide. |
| `sdk/src/security.ts` | extremely dangerous | 5% | signing protocol. |

## File Cost Ranking

Cheap: presentational UI, docs pages, small formatting helpers.

Medium: app pages, route files, settings sections, OpenClaw intent/router rendering.

Expensive: `telemetryRepository.ts`, `authService.ts`, `notificationService.ts`, `forecastService.ts`, `reportService.ts`, `sdk/src/transport.ts`, `frontend/src/lib/api.ts`.

Very expensive: `middleware/auth.ts`, `db/schema.ts`, `db/database.ts`, `sdk/src/security.ts`, `AuthContext.tsx`, `StatusContext.tsx`.

## Dependency Heatmap

| File | Heat | Ripple |
|---|---:|---|
| `backend/src/db/schema.ts` | extreme | all persistence/startup |
| `backend/src/db/database.ts` | extreme | all DB access |
| `backend/src/services/authService.ts` | extreme | auth, workspace, keys, settings |
| `backend/src/middleware/auth.ts` | extreme | all protected routes |
| `backend/src/services/telemetryRepository.ts` | extreme | analytics, requests, forecast, reports, intelligence |
| `frontend/src/lib/api.ts` | high | most dashboard data |
| `frontend/src/contexts/AuthContext.tsx` | high | all protected UI |
| `frontend/src/contexts/StatusContext.tsx` | high | live refresh |
| `sdk/src/transport.ts` | high | all SDK delivery |
| `backend/src/services/notificationService.ts` | medium-high | ingest alerts, settings, scheduler |
| `backend/src/services/copilotService.ts` | medium-high | many backend services |

## Dangerous Invariants

- Workspace-scoped data must always filter by `workspace_id`.
- Plain API keys exist only at create/regenerate/signup response time.
- `requests` remains canonical; analytics should be derived unless explicitly redesigned.
- `StatusContext` owns SSE.
- Signed ingest protocol is a two-sided SDK/backend contract.
- Ingest path should stay fast and should not await slow AI/email/report work.

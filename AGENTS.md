# CLAUDE.md

Permanent project memory for TokenWatch. This file is the fast index. Load deeper docs only when the current task requires them.

## Memorize These Facts

- `requests` table is the source of truth for telemetry, analytics, exports, forecasts, reports, and intelligence.
- `backend/src/services/telemetryRepository.ts` owns all request SQL, analytics aggregation, request filters, dimensions, and exports. Whenever analytics, request logs, filters, or exports are mentioned, assume this is the first backend stop.
- `backend/src/services/authService.ts` owns users, workspaces, API keys, workspace settings persistence, and API key permissions.
- `backend/src/middleware/auth.ts` owns cookie auth, API-key auth, workspace enforcement, and permission gates.
- `backend/src/db/schema.ts` owns database shape. `backend/src/db/database.ts` applies schema and ALTER updates on startup. There is no migrations folder.
- `backend/src/services/ingestService.ts` owns ingest validation, normalization, cache invalidation, SSE event emission, and alert evaluation trigger.
- `frontend/src/contexts/StatusContext.tsx` owns the single dashboard SSE `EventSource`.
- `frontend/src/contexts/AuthContext.tsx` owns user/session/workspace selection and `tokenwatch.currentWorkspaceId`.
- `frontend/src/lib/api.ts` owns frontend API contracts, fetch wrappers, query hooks, and shared frontend API types.
- `sdk/src/transport.ts` owns SDK queueing, batching, retries, signing, identity lookup, and shutdown flush.
- `sdk/src/security.ts` and `backend/src/utils/sdkAuth.ts` are paired. Change signed ingest protocol on both sides or neither.
- OpenClaw is an API client bridge only. It never writes the TokenWatch database directly.

## Search Budget

Default maximum files to inspect before stopping:

| Task type | File budget | Rule |
|---|---:|---|
| Simple bug | 5 | Stop when owning file is found and edit there. |
| Feature | 8 | Route/service/page/API-client only unless schema/auth is involved. |
| Refactor | 15 | Continue only with a clear dependency chain. |
| Security/auth/db/SDK transport | 12 | Spend budget cautiously; verify invariants. |
| Architecture/docs audit | unlimited | Only when explicitly requested. |

If the budget is exceeded, stop and explain: files read, what is still unknown, and why more exploration is needed.

Never inspect `node_modules`, `dist`, `build`, `coverage`, `.git`, lockfiles, or generated output for normal feature work.

## Which Doc To Load

| Need | Load |
|---|---|
| High-level flow/lifecycles/connections | `docs/architecture.md` |
| Backend routes/services/auth/notifications/AI | `docs/backend.md` |
| Frontend pages/components/context/data flow | `docs/frontend.md` |
| SDK behavior, batching, retries, signing | `docs/sdk.md` |
| Tables, columns, indexes, schema rules | `docs/database.md` |
| Endpoint auth/request/response ownership | `docs/api.md` |
| Common tasks and exact edit locations | `docs/playbooks.md` |
| Ownership, risk, cost, heatmaps, symbol map | `docs/ownership.md` |

Do not load all docs by default. Use the decision tree below.

## Decision Tree

### Need To Fix Login/Auth?

1. Browser cookie/session issue -> `frontend/src/contexts/AuthContext.tsx`, `backend/src/routes/auth.ts`, `backend/src/config/cookies.ts`.
2. JWT issue -> `backend/src/utils/auth.ts`, `backend/src/middleware/auth.ts`.
3. Password/signup/login validation -> `backend/src/routes/auth.ts`.
4. User/workspace persistence -> `backend/src/services/authService.ts`.
5. API key issue -> `backend/src/services/authService.ts`, `backend/src/middleware/auth.ts`.
6. Signed SDK ingest issue -> `sdk/src/security.ts`, `backend/src/utils/sdkAuth.ts`, `sdk/src/transport.ts`.

### Need To Fix Workspace/Settings?

1. Workspace CRUD/API key/settings persistence -> `backend/src/services/authService.ts`.
2. HTTP validation/route behavior -> `backend/src/routes/workspaces.ts`.
3. Settings page behavior -> `frontend/src/pages/app/Settings.tsx`.
4. Individual settings UI -> `frontend/src/pages/app/settings/*Section.tsx`.
5. Client settings API calls -> `frontend/src/pages/app/settings/api.ts`.
6. Client validation -> `frontend/src/pages/app/settings/validation.ts`.

### Need To Fix Telemetry Ingest?

1. Payload shape/normalization -> `backend/src/services/ingestService.ts`.
2. Insert/query storage -> `backend/src/services/telemetryRepository.ts`.
3. API auth/rate limit -> `backend/src/routes/ingest.ts`, `backend/src/middleware/auth.ts`.
4. SDK generated fields -> `sdk/src/generator.ts`, `sdk/src/types.ts`.
5. SDK delivery/retry/batching -> `sdk/src/transport.ts`.
6. Realtime refresh after ingest -> `backend/src/services/telemetryBus.ts`, `backend/src/services/realtimeStreamService.ts`, `frontend/src/contexts/StatusContext.tsx`.

### Need To Fix Analytics/Charts?

1. Data wrong before UI -> `backend/src/services/telemetryRepository.ts`.
2. Cache stale -> `backend/src/services/analyticsService.ts`, `backend/src/services/analyticsCache.ts`.
3. API shape wrong -> `backend/src/routes/analytics.ts`, `frontend/src/lib/api.ts`.
4. Overview page chart -> `frontend/src/pages/app/Overview.tsx`, `frontend/src/components/overview/*`.
5. Model/entity chart -> `frontend/src/pages/app/Models.tsx`, `frontend/src/components/analytics/EntityCharts.tsx`.
6. Endpoint/entity chart -> `frontend/src/pages/app/Endpoints.tsx`, `frontend/src/components/analytics/EntityCharts.tsx`.

### Need To Fix Requests Page?

1. Backend filters/search/sort/pagination/export -> `backend/src/routes/requests.ts`, `backend/src/services/telemetryRepository.ts`.
2. Frontend query params -> `frontend/src/lib/api.ts`.
3. Table/filter UX -> `frontend/src/pages/app/Requests.tsx`.
4. Drawer fields -> `frontend/src/components/RequestDetailDrawer.tsx`.
5. Export button behavior -> `frontend/src/components/overview/ExportButton.tsx` or page-local export code.

### Need To Fix Email/Notifications?

1. Send transport/Resend -> `backend/src/services/emailService.ts`.
2. Email HTML -> `backend/src/services/emailTemplates.ts`.
3. Alert/digest/report rules -> `backend/src/services/notificationService.ts`.
4. Settings route validation -> `backend/src/routes/workspaces.ts`.
5. UI settings -> `frontend/src/pages/app/settings/SettingsEmailNotificationsSection.tsx`, `SettingsAlertsSection.tsx`, `SettingsWebhookSection.tsx`.

### Need To Fix Forecast/Reports/AI/Copilot?

1. Forecast math/cache -> `backend/src/services/forecastService.ts`.
2. Reports/export -> `backend/src/services/reportService.ts`.
3. AI provider -> `backend/src/services/geminiService.ts`.
4. AI insights -> `backend/src/services/aiInsightsService.ts`.
5. Recommendations -> `backend/src/services/recommendationService.ts`.
6. Anomalies -> `backend/src/services/anomalyService.ts`.
7. Root cause -> `backend/src/services/rootCauseService.ts`.
8. Copilot tools/prompts/memory -> `backend/src/services/copilotService.ts`.
9. Copilot HTTP/SSE route -> `backend/src/routes/copilot.ts`.
10. OpenClaw Telegram intent/tool -> `openclaw/src/router/intentRouter.ts`, `openclaw/src/tokenwatcher/tools.ts`.

### Need To Add A Route/Page/Field?

1. Backend route -> existing `backend/src/routes/*.ts` or new route plus `backend/src/routes/index.ts`.
2. Service logic -> `backend/src/services/<owner>Service.ts`.
3. Database column -> `backend/src/db/schema.ts`, `backend/src/db/database.ts`, owner service normalizers, repository select/insert if needed.
4. Frontend API contract -> `frontend/src/lib/api.ts` or `frontend/src/pages/app/settings/api.ts`.
5. Frontend page route -> `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx`, new page under `frontend/src/pages/app`.

## Symbol Index

### Authentication

| Symbol | File |
|---|---|
| `authenticateUser` | `backend/src/middleware/auth.ts` |
| `authenticateSDK` | `backend/src/middleware/auth.ts` |
| `authenticateWorkspaceAccess` | `backend/src/middleware/auth.ts` |
| `authenticateIdentity` | `backend/src/middleware/auth.ts` |
| `requireOwnedWorkspace` | `backend/src/middleware/auth.ts` |
| `requireApiKeyPermission` | `backend/src/middleware/auth.ts` |
| `verifyJwt`, `createJwt` | `backend/src/utils/auth.ts` |
| `hashPassword`, `verifyPassword` | `backend/src/utils/auth.ts` |
| `hashApiKey`, `generateApiKey` | `backend/src/utils/auth.ts` |
| `verifySignedSdkRequest` | `backend/src/utils/sdkAuth.ts` |

### Users, Workspaces, API Keys

| Symbol | File |
|---|---|
| `createUser`, `findUserByEmail`, `findUserById` | `backend/src/services/authService.ts` |
| `createWorkspace`, `getWorkspace`, `getUserWorkspaces` | `backend/src/services/authService.ts` |
| `updateWorkspace`, `deleteWorkspace` | `backend/src/services/authService.ts` |
| `getWorkspaceSettings`, `updateWorkspaceSettings` | `backend/src/services/authService.ts` |
| `generateWorkspaceApiKey`, `regenerateWorkspaceApiKey` | `backend/src/services/authService.ts` |
| `listWorkspaceApiKeys`, `getWorkspaceApiKey`, `revokeWorkspaceApiKey` | `backend/src/services/authService.ts` |
| `verifyApiKey`, `hasApiKeyPermission` | `backend/src/services/authService.ts` |
| `normalizeApiKeyType`, `normalizeApiKeyPermissions` | `backend/src/services/authService.ts` |

### Telemetry and Analytics

| Symbol | File |
|---|---|
| `validateTelemetryPayload`, `ingestTelemetry` | `backend/src/services/ingestService.ts` |
| `insertTelemetry`, `insertTelemetryBatch` | `backend/src/services/telemetryRepository.ts` |
| `listLatestTelemetry`, `listRequestLog`, `listForExport` | `backend/src/services/telemetryRepository.ts` |
| `getAnalyticsSnapshot`, `listTelemetryDimensions` | `backend/src/services/telemetryRepository.ts` |
| `listTelemetryHistoryBuckets` | `backend/src/services/telemetryRepository.ts` |
| `listTelemetryResourcePeriodSummaries` | `backend/src/services/telemetryRepository.ts` |
| `getTelemetryCount`, `getCurrentMonthSpend` | `backend/src/services/telemetryRepository.ts` |
| `buildAnalyticsSnapshot`, `buildRealtimeAnalyticsSnapshot` | `backend/src/services/analyticsService.ts` |
| `getCachedAnalytics`, `setCachedAnalytics`, `invalidateAnalyticsCache` | `backend/src/services/analyticsCache.ts` |
| `telemetryBus` | `backend/src/services/telemetryBus.ts` |
| `setupWorkspaceSse`, `getActiveSseConnections` | `backend/src/services/realtimeStreamService.ts` |

### Forecast, Reports, Intelligence, AI

| Symbol | File |
|---|---|
| `generateForecast`, `generateSpendForecast` | `backend/src/services/forecastService.ts` |
| `generateRequestForecast`, `generateBudgetForecast` | `backend/src/services/forecastService.ts` |
| `generateReport`, `exportReport` | `backend/src/services/reportService.ts` |
| `parseReportType`, `parseExportFormat` | `backend/src/services/reportService.ts` |
| `generateInsightsWithGemini` | `backend/src/services/geminiService.ts` |
| `generateInsightsForWorkspace`, `buildAnalyticsSummary` | `backend/src/services/aiInsightsService.ts` |
| `generateRecommendations` | `backend/src/services/recommendationService.ts` |
| `detectAnomalies` | `backend/src/services/anomalyService.ts` |
| `calculateEfficiencyScore` | `backend/src/services/efficiencyScoreService.ts` |
| `analyzeRootCause`, `validateRootCauseRequest` | `backend/src/services/rootCauseService.ts` |
| `runCopilotChat`, `runCopilotReport` | `backend/src/services/copilotService.ts` |
| `runCopilotExplain`, `runCopilotForecast` | `backend/src/services/copilotService.ts` |
| `validateCopilotRequest`, `getCopilotPrompts` | `backend/src/services/copilotService.ts` |

### Notifications and Email

| Symbol | File |
|---|---|
| `isValidNotificationEmail` | `backend/src/services/notificationService.ts` |
| `sendTestNotification`, `sendDailyDigest` | `backend/src/services/notificationService.ts` |
| `sendWeeklyExecutiveReport` | `backend/src/services/notificationService.ts` |
| `evaluateWorkspaceAlerts` | `backend/src/services/notificationService.ts` |
| `startNotificationScheduler`, `processDueScheduledNotifications` | `backend/src/services/notificationService.ts` |
| `sendEmail`, `EmailProviderError` | `backend/src/services/emailService.ts` |
| `renderTokenWatcherEmail` | `backend/src/services/emailTemplates.ts` |

### Frontend

| Symbol | File |
|---|---|
| `AuthProvider`, `useAuth` | `frontend/src/contexts/AuthContext.tsx` |
| `StatusProvider`, `useStatus` | `frontend/src/contexts/StatusContext.tsx` |
| `authFetch`, `apiBaseUrl` | `frontend/src/lib/api.ts` |
| `fetchHealth`, `fetchAnalyticsSnapshot`, `fetchRequestLog` | `frontend/src/lib/api.ts` |
| `useHealthQuery`, `useAnalyticsSnapshotQuery` | `frontend/src/lib/api.ts` |
| `useTelemetryRowsQuery`, `useRequestLogQuery` | `frontend/src/lib/api.ts` |
| `setRequestLogRefreshEnabled` | `frontend/src/lib/api.ts` |
| `ProtectedRoute` | `frontend/src/components/ProtectedRoute.tsx` |
| `AppLayout`, `Sidebar`, `GlobalStatusHeader` | `frontend/src/components/*.tsx` |
| `useOverviewFilters`, `getRowStatus` | `frontend/src/hooks/useOverviewFilters.ts` |

### SDK

| Symbol | File |
|---|---|
| `init`, `track`, `identify`, `simulate` | `sdk/src/client.ts` |
| `startSimulation`, `stopSimulation`, `flush`, `stats` | `sdk/src/client.ts` |
| `postJson`, `flushAndShutdown`, `getTransportStats` | `sdk/src/transport.ts` |
| `configureTransport`, `getQueueSize` | `sdk/src/transport.ts` |
| `createSignedHeaders` | `sdk/src/security.ts` |
| `createTrackRecord`, `createIdentifyRecord`, `createSimulationRecord` | `sdk/src/generator.ts` |
| `getState`, `setConfig`, `snapshot`, `resetRuntimeState` | `sdk/src/state.ts` |
| `createBoundedQueue` | `sdk/src/internal/queue.ts` |
| `createRetryPolicy`, `classifyError` | `sdk/src/internal/retryPolicy.ts` |

## Folder Ownership Score

Higher safe score means lower caution for localized edits.

| Folder/File | Safety | Safe score | Notes |
|---|---|---:|---|
| `frontend/src/components/ui` | safe | 95% | UI primitives, but avoid broad design churn. |
| `frontend/src/components` | safe | 85% | Mostly presentational. |
| `frontend/src/pages` | safe | 80% | Page-local state and composition. |
| `frontend/src/lib/api.ts` | medium | 55% | Query keys/API contracts ripple through UI. |
| `frontend/src/contexts` | cautious | 35% | App-wide auth/SSE state. |
| `backend/src/routes` | safe | 80% | Thin HTTP layer if service contracts unchanged. |
| `backend/src/services` | medium | 55% | Business logic; inspect owner only. |
| `backend/src/services/telemetryRepository.ts` | dangerous | 20% | Central SQL and performance hotspot. |
| `backend/src/services/authService.ts` | dangerous | 15% | Users/workspaces/API keys. |
| `backend/src/middleware/auth.ts` | very dangerous | 10% | Security boundary. |
| `backend/src/db` | very dangerous | 10% | Schema/startup-wide impact. |
| `sdk/src/client.ts` | medium | 50% | Public SDK API. |
| `sdk/src/transport.ts` | dangerous | 15% | Delivery semantics. |
| `sdk/src/security.ts` | extremely dangerous | 5% | Protocol compatibility/security. |
| `openclaw/src/router` | safe | 80% | Intent routing only. |
| `openclaw/src/tokenwatcher` | medium | 55% | Backend API bridge contracts. |

## File Cost Ranking

| Cost | Files |
|---|---|
| Cheap | `frontend/src/components/ui/button.tsx`, `badge.tsx`, `toast.tsx`, presentational cards, docs pages |
| Medium | `frontend/src/pages/app/Overview.tsx`, `Models.tsx`, `Endpoints.tsx`, `Requests.tsx`, `Settings.tsx`, route files |
| Expensive | `backend/src/services/telemetryRepository.ts`, `authService.ts`, `notificationService.ts`, `forecastService.ts`, `reportService.ts`, `sdk/src/transport.ts` |
| Very expensive | `backend/src/middleware/auth.ts`, `backend/src/db/schema.ts`, `backend/src/db/database.ts`, `sdk/src/security.ts`, `frontend/src/contexts/AuthContext.tsx`, `StatusContext.tsx` |

## Dependency Heatmap

Approximate ripple risk, not exact import counts.

| File | Heat | Why |
|---|---:|---|
| `backend/src/db/schema.ts` | extreme | All persistence and startup depend on it. |
| `backend/src/db/database.ts` | extreme | All DB access and schema application. |
| `backend/src/services/authService.ts` | extreme | Auth, workspaces, keys, settings, many routes. |
| `backend/src/middleware/auth.ts` | extreme | Nearly every protected route. |
| `backend/src/services/telemetryRepository.ts` | extreme | Analytics, exports, requests, forecasts, intelligence, reports. |
| `frontend/src/lib/api.ts` | high | API types and query hooks for dashboard. |
| `frontend/src/contexts/AuthContext.tsx` | high | Every protected page. |
| `frontend/src/contexts/StatusContext.tsx` | high | Health, SSE, query invalidation. |
| `sdk/src/transport.ts` | high | All SDK delivery. |
| `backend/src/services/notificationService.ts` | medium-high | Settings, ingest alerts, scheduler, reports/email. |
| `backend/src/services/copilotService.ts` | medium-high | AI tools call many backend services. |

## Performance Hotspots

Performance-critical files:

- `backend/src/services/telemetryRepository.ts`
- `backend/src/services/analyticsService.ts`
- `backend/src/services/analyticsCache.ts`
- `backend/src/services/forecastService.ts`
- `backend/src/services/notificationService.ts`
- `backend/src/services/realtimeStreamService.ts`
- `sdk/src/transport.ts`
- `frontend/src/pages/app/Requests.tsx`
- `frontend/src/components/analytics/EntityCharts.tsx`
- `frontend/src/components/overview/OverviewCharts.tsx`

Performance rules:

- Never read all `requests` rows for dashboard views.
- Always paginate request logs.
- Cap exports intentionally; current export cap is 100k rows.
- Keep analytics workspace-scoped and indexed by timestamp/model/route/error.
- Avoid O(n^2) loops on telemetry rows, request logs, models, endpoints, and SSE events.
- Avoid opening duplicate EventSource instances; `StatusContext` owns SSE.
- Do not make ingest await email/report/AI work. Alert evaluation must stay async/best-effort.
- SDK queue must stay bounded and must not retry permanent 4xx errors.

## Fast Task Recipes

| Task | Files | Tests/build | Never touch |
|---|---|---|---|
| Add API key permission | `authService.ts`, `middleware/auth.ts`, route using permission | `backend npm run build`, permission test | analytics pages |
| Add workspace setting | `schema.ts`, `database.ts`, `authService.ts`, `routes/workspaces.ts`, settings UI/API | backend + frontend build | SDK transport |
| Add telemetry metadata field | `sdk/types.ts`, `sdk/generator.ts`, `ingestService.ts` | SDK test + backend build | DB schema unless query/index needed |
| Add first-class telemetry column | `schema.ts`, `database.ts`, `ingestService.ts`, `telemetryRepository.ts`, frontend types | backend + frontend + SDK | unrelated auth |
| Fix request filter | `routes/requests.ts`, `telemetryRepository.ts`, `frontend/src/lib/api.ts`, `Requests.tsx` | backend + frontend build | authService |
| Fix dashboard refresh | `StatusContext.tsx`, `lib/api.ts`, `realtimeStreamService.ts`, `telemetryBus.ts` | frontend build | database schema |
| Fix budget alert | `notificationService.ts`, `BudgetAlertCard.tsx`, `telemetryRepository.ts` current spend | backend/frontend tests | SDK security |
| Add report type | `reportService.ts`, `routes/reports.ts`, OpenClaw tools if needed | backend/openclaw build | ingest service |
| Add OpenClaw command | `intentRouter.ts`, `tokenwatcher/tools.ts`, `telegram/render.ts` | openclaw build | backend DB |
| Fix SDK retry | `sdk/src/transport.ts`, `sdk/src/internal/retryPolicy.ts` | SDK test | backend analytics |

More recipes live in `docs/playbooks.md`.

## Operational Commands

```bash
cd backend && npm run build
cd frontend && npm run build
cd frontend && npm run test
cd sdk && npm run test
cd openclaw && npm run build
```

## Model Routing Guidance

Guidance only; Claude Code does not automatically switch models.

| Task | Suggested model |
|---|---|
| Tiny copy/UI tweak | cheap coding model |
| Single route/component bug | cheap or medium coding model |
| Auth, workspace isolation, DB schema, SDK transport/signing | strongest reasoning/coding model |
| Analytics SQL or forecasting math | medium to strong reasoning model |
| Large refactor or repo understanding | strongest long-context model |

## Final Rules

- Use this file first.
- Load exactly one deeper doc when necessary.
- Search by symbol from the Symbol Index before using broad `rg`.
- If a file is listed as expensive or dangerous, make small edits and run the relevant build/test.
- Preserve workspace isolation and `requests` as canonical telemetry storage.

# Playbooks

Use these recipes before searching.

| Task | Edit files | Verify | Do not touch |
|---|---|---|---|
| Add backend endpoint | owning `routes/*.ts`, service file, `routes/index.ts` if new router | backend build | frontend unless consumed |
| Add dashboard page | new `pages/app/*.tsx`, `App.tsx`, `Sidebar.tsx`, `lib/api.ts` if data needed | frontend build | backend unless new data |
| Add settings field | `schema.ts`, `database.ts`, `authService.ts`, `routes/workspaces.ts`, `settings/api.ts`, `Settings.tsx`, section, validation | backend + frontend build | SDK |
| Add API key type | `authService.ts`, `utils/auth.ts` if prefix format changes, settings UI, OpenClaw if needed | backend build + permission tests | analytics |
| Add API key permission | `authService.ts`, `middleware/auth.ts`, target route | backend build + permission tests | DB unless persisted shape changes |
| Fix login cookie | `AuthContext.tsx`, `routes/auth.ts`, `config/cookies.ts` | backend + frontend build | telemetry repository |
| Fix JWT/session | `utils/auth.ts`, `middleware/auth.ts`, `routes/auth.ts` | backend build | dashboard pages |
| Fix workspace forbidden | `middleware/auth.ts`, route params/query/body, `authService.getWorkspace` | backend build | frontend charts |
| Fix ingest payload | `ingestService.ts`, SDK `generator.ts/types.ts` if SDK-produced | backend + SDK tests | analytics UI |
| Fix ingest auth/signature | `middleware/auth.ts`, `utils/sdkAuth.ts`, `sdk/security.ts`, `sdk/transport.ts` | backend + SDK tests | reports |
| Add telemetry metadata | `sdk/types.ts`, `sdk/generator.ts`, `ingestService.ts` | SDK + backend build | schema unless indexed |
| Add telemetry column | `schema.ts`, `database.ts`, `ingestService.ts`, `telemetryRepository.ts`, frontend types | all relevant builds | OpenClaw unless exposed |
| Fix analytics totals | `telemetryRepository.ts`, `analyticsService.ts` | backend build | chart styling |
| Fix stale analytics | `analyticsCache.ts`, invalidation call site | backend build | SQL unless data wrong |
| Fix chart rendering | owning page + chart component | frontend build/test | backend unless API data wrong |
| Fix request search | `routes/requests.ts`, `telemetryRepository.ts`, `lib/api.ts`, `Requests.tsx` | backend + frontend build | authService |
| Fix request export | `routes/requests.ts`, `telemetryRepository.ts`, `telemetryPdfService.ts` | backend build | frontend if button unchanged |
| Add report type | `reportService.ts`, `routes/reports.ts`, OpenClaw tools if needed | backend + openclaw build | ingest |
| Fix report PDF | `reportService.ts`, `pdfGeneratorService.ts` | backend build | request filters |
| Add forecast metric | `forecastService.ts`, route if exposed, report/copilot/OpenClaw if consumed | backend build | schema |
| Fix recommendations | `recommendationService.ts`, maybe `telemetryRepository.ts` period summaries | backend build | frontend unless display issue |
| Fix anomaly detection | `anomalyService.ts`, period summary SQL only if data wrong | backend build | reports unless consuming |
| Fix root cause | `rootCauseService.ts`, `geminiService.ts` only for provider issue | backend build | anomaly thresholds |
| Fix copilot answer | `copilotService.ts`, `geminiService.ts` if provider | backend build | frontend |
| Fix copilot streaming | `routes/copilot.ts` | backend build | copilot tool logic |
| Fix email send | `emailService.ts`, env docs | backend build | templates if content OK |
| Fix email content | `emailTemplates.ts`, `notificationService.ts` caller data | backend build | Resend transport |
| Fix digest schedule | `notificationService.ts`, `workspace_settings` schedule fields if schema issue | backend build | frontend charts |
| Fix webhook test | `routes/workspaces.ts`, settings UI section if display issue | backend/frontend build | notification scheduler |
| Fix SSE reconnect | `StatusContext.tsx`, `realtimeStreamService.ts` | frontend + backend build | ingest SQL |
| Fix health payload | `routes/health.ts`, `StatusContext.tsx`, `GlobalStatusHeader.tsx` | backend/frontend build | auth |
| Add OpenClaw command | `intentRouter.ts`, `tokenwatcher/tools.ts`, `telegram/render.ts` | openclaw build | backend DB |
| Fix OpenClaw auth | `openclaw/src/main.ts`, backend API key permissions | openclaw + backend build | frontend |
| Fix SDK retry/backoff | `sdk/src/transport.ts`, `internal/retryPolicy.ts` | SDK test | backend analytics |
| Fix SDK shutdown | `sdk/src/transport.ts`, `internal/shutdown.ts` | SDK test | backend |
| Fix SDK public API | `sdk/src/client.ts`, `namespace.ts`, `index.ts`, `types.ts` | SDK test/build | backend unless endpoint changes |
| Change CORS | `backend/src/core/app.ts`, `config/env.ts` | backend build | route files |
| Add env var | owning `config/env.ts`, docs, deployment docs if needed | relevant build | unrelated runtime |

If a recipe points to more than 8 files, stage it: backend contract first, then frontend, then SDK/OpenClaw.

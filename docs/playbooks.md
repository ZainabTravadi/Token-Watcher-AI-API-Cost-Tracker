# Playbooks

Use these fast recipes when you know the feature area but want the safest file path.

## Table Of Contents

- [Backend Changes](#backend-changes)
- [Frontend Changes](#frontend-changes)
- [Database Changes](#database-changes)
- [SDK Changes](#sdk-changes)
- [OpenClaw Changes](#openclaw-changes)
- [Related Docs](#related-docs)

## Backend Changes

| Task | Edit files | Verify |
|---|---|---|
| Add endpoint | owning route file and service | backend build |
| Update workspace settings | schema, database startup, auth service, workspace routes | backend build |
| Change auth behavior | middleware, auth utilities, auth route | backend build |
| Add analytics output | telemetry repository and route | backend build |
| Add report or forecast | report or forecast service plus route | backend build |

## Frontend Changes

| Task | Edit files | Verify |
|---|---|---|
| Add dashboard data | `frontend/src/lib/api.ts` plus the page or component | frontend build |
| Add settings field | settings API, validation, page section, backend route, schema if needed | frontend + backend build |
| Change SSE behavior | `StatusContext.tsx`, stream route, realtime service | frontend + backend build |
| Update docs page | `frontend/src/pages/docs/DocsPage.tsx` | frontend build |

## Database Changes

| Task | Edit files | Verify |
|---|---|---|
| Add a persisted field | `backend/src/db/schema.ts`, `backend/src/db/database.ts`, owning service | backend build |
| Add a first-class telemetry column | schema, database startup, ingest service, telemetry repository | backend build |

## SDK Changes

| Task | Edit files | Verify |
|---|---|---|
| Add telemetry metadata | `sdk/src/types.ts`, `sdk/src/generator.ts`, `backend/src/services/ingestService.ts` | SDK + backend build |
| Change delivery behavior | `sdk/src/transport.ts`, retry policy, shutdown logic | SDK tests |

## OpenClaw Changes

| Task | Edit files | Verify |
|---|---|---|
| Add a Telegram command | intent router, tool registry, Telegram renderers | OpenClaw build |
| Change bridge auth | OpenClaw config and backend Telegram integration resolver | OpenClaw + backend build |

## Related Docs

▪️ [`backend.md`](backend.md)
▪️ [`frontend.md`](frontend.md)
▪️ [`database.md`](database.md)
▪️ [`sdk.md`](sdk.md)
▪️ [`openclaw.md`](openclaw.md)

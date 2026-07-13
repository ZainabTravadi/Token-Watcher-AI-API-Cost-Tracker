# Ownership

Use this file when deciding what to inspect, edit, or avoid.

## Table Of Contents

- [Risk Levels](#risk-levels)
- [High-Ripple Files](#high-ripple-files)
- [Invariants](#invariants)

## Risk Levels

| Folder or file | Risk | Notes |
|---|---|---|
| `frontend/src/components/ui` | safe | UI primitives |
| `frontend/src/components` | safe | mostly presentational |
| `frontend/src/pages` | safe | page-local behavior |
| `backend/src/routes` | safe | thin HTTP layer |
| `openclaw/src/router` | safe | intent routing only |
| `frontend/src/lib/api.ts` | medium | query and contract ripple |
| `backend/src/services` | medium | business logic |
| `openclaw/src/tokenwatcher` | medium | API bridge contracts |
| `frontend/src/contexts` | cautious | app-wide state |
| `backend/src/services/telemetryRepository.ts` | dangerous | telemetry SQL and analytics hotspot |
| `backend/src/services/authService.ts` | dangerous | users, workspaces, API keys |
| `backend/src/middleware/auth.ts` | very dangerous | security boundary |
| `backend/src/db` | very dangerous | schema and startup-wide impact |
| `sdk/src/transport.ts` | dangerous | delivery semantics |
| `sdk/src/security.ts` | extremely dangerous | signed ingest protocol |

## High-Ripple Files

▪️ `backend/src/db/schema.ts`
▪️ `backend/src/db/database.ts`
▪️ `backend/src/services/authService.ts`
▪️ `backend/src/middleware/auth.ts`
▪️ `backend/src/services/telemetryRepository.ts`
▪️ `frontend/src/lib/api.ts`
▪️ `frontend/src/contexts/AuthContext.tsx`
▪️ `frontend/src/contexts/StatusContext.tsx`
▪️ `sdk/src/transport.ts`

## Invariants

▪️ workspace-scoped data must always filter by `workspace_id`
▪️ plaintext API keys should only appear at create or rotate time
▪️ `requests` remains canonical telemetry storage
▪️ `StatusContext` owns the single dashboard EventSource
▪️ ingest should not wait on slow AI or email work
▪️ signed ingest is a two-sided SDK and backend contract


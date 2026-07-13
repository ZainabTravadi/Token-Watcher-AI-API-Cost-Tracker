# Database

TokenWatch uses PostgreSQL only.
There is no migrations directory.
Schema creation and idempotent ALTER updates happen in `backend/src/db/schema.ts` and `backend/src/db/database.ts`.

## Table Of Contents

- [Tables](#tables)
- [Indexes](#indexes)
- [Data Rules](#data-rules)
- [Related Docs](#related-docs)

## Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | dashboard users | `id`, `email`, `password_hash`, timestamps, `last_logout_at` |
| `workspaces` | workspace ownership and budget | `id`, `user_id`, `name`, `monthly_budget`, `webhook_url` |
| `api_keys` | SDK, OpenClaw, and admin keys | `id`, `workspace_id`, `key_hash`, `label`, `type`, `permissions`, lifecycle timestamps |
| `audit_events` | audit trail for workspace actions | `workspace_id`, `actor_user_id`, `event_type`, `target_type`, metadata |
| `telegram_integrations` | Telegram bot connections | `workspace_id`, `telegram_bot_id`, `telegram_bot_username`, encrypted token fields, webhook fields |
| `workspace_settings` | alert, digest, report, and webhook settings | alert toggles, thresholds, notification state, schedule fields |
| `requests` | canonical telemetry store | `workspace_id`, `timestamp`, `route`, `model`, `provider`, token counts, cost, latency, error, metadata |

## Indexes

| Index | Purpose |
|---|---|
| `idx_users_email` | login lookup |
| `idx_workspaces_user_id` | workspace listing |
| `idx_api_keys_workspace_id` | key listing |
| `idx_api_keys_hash_active` | API key verification |
| `idx_api_keys_expires_at` | expiry filtering |
| `idx_api_keys_revoked_at` | revocation filtering |
| `idx_requests_timestamp` | global time queries |
| `idx_requests_workspace_timestamp` | workspace dashboards and logs |
| `idx_requests_route` | route filtering |
| `idx_requests_workspace_route_timestamp` | route analytics |
| `idx_requests_workspace_model_timestamp` | model analytics |
| `idx_requests_workspace_error_timestamp` | error analytics |
| `idx_requests_workspace_id` | workspace-scoped counts and cleanup |
| `idx_telegram_integrations_workspace_id` | Telegram lookup by workspace |
| `idx_telegram_integrations_bot_id` | Telegram lookup by bot id |
| `idx_telegram_integrations_enabled` | enabled integrations |
| `idx_audit_events_workspace_created_at` | audit history |

## Data Rules

▪️ `requests` is the source of truth for telemetry, analytics, exports, forecasts, and recommendations
▪️ workspace isolation must always be enforced
▪️ telemetry rows are scoped by `workspace_id`
▪️ analytics should be derived, not duplicated, unless the architecture changes intentionally
▪️ plaintext API keys and bot tokens should be shown only once when created or rotated

## Related Docs

▪️ [`architecture.md`](architecture.md)
▪️ [`backend.md`](backend.md)
▪️ [`operations.md`](operations.md)

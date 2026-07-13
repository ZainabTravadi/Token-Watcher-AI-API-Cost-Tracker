# Database

PostgreSQL only. Schema is code-owned by `backend/src/db/schema.ts`; startup applies schema and idempotent ALTER updates in `backend/src/db/database.ts`.

There is no migrations directory.

## Tables

### `users`

Columns: `id`, `email`, `password_hash`, `created_at`, `updated_at`, `last_logout_at`.

Owner: `authService.ts`.

Writes: signup, logout timestamp.

Reads: login, auth/me, API-key owner lookup.

### `workspaces`

Columns: `id`, `user_id`, `name`, `monthly_budget`, `webhook_url`, `created_at`, `updated_at`.

Owner: `authService.ts`.

Writes: signup, create/update/delete workspace.

Reads: auth, analytics budget, settings, notifications, API-key identity.

### `api_keys`

Columns: `id`, `workspace_id`, `key_hash`, `label`, `type`, `permissions`, `created_by`, `created_at`, `last_used_at`, `expires_at`, `revoked_at`.

Owner: `authService.ts`.

Writes: workspace creation, key create/regenerate/revoke, throttled last-used update.

Reads: SDK/OpenClaw auth, settings UI.

### `workspace_settings`

Columns: alert toggles, digest/report toggles, thresholds, notification email, verification, last-sent timestamps, schedule fields, webhook test fields, timestamps.

Owner: `authService.ts` for persistence; `notificationService.ts` for notification side effects.

Writes: workspace creation, settings update, test email, scheduled sends, alerts, webhook test.

Reads: settings UI, scheduler, alert evaluation.

### `requests`

Columns: `id`, `workspace_id`, `timestamp`, `route`, `model`, `provider`, `input_tokens`, `output_tokens`, `total_tokens`, `cost_usd`, `latency_ms`, `error`, `metadata`.

Owner: `ingestService.ts` and `telemetryRepository.ts`.

Writes: ingest, simulators, request record service.

Reads: analytics, request log, exports, forecast, intelligence, reports, notifications.

## Foreign Keys

| FK | Behavior |
|---|---|
| `workspaces.user_id -> users.id` | `ON DELETE CASCADE` |
| `api_keys.workspace_id -> workspaces.id` | `ON DELETE CASCADE` |
| `api_keys.created_by -> users.id` | `ON DELETE SET NULL` |
| `workspace_settings.workspace_id -> workspaces.id` | `ON DELETE CASCADE`, unique |
| `requests.workspace_id -> workspaces.id` | `ON DELETE CASCADE` |

## Indexes

| Index | Purpose |
|---|---|
| `idx_users_email` | login lookup |
| `idx_workspaces_user_id` | list user workspaces |
| `idx_api_keys_workspace_id` | settings/key listing |
| `idx_api_keys_hash_active` | API key verification |
| `idx_api_keys_expires_at`, `idx_api_keys_revoked_at` | key lifecycle |
| `idx_requests_timestamp` | global time queries |
| `idx_requests_workspace_timestamp` | latest rows, dashboard, request log |
| `idx_requests_workspace_route_timestamp` | endpoint filters/analytics |
| `idx_requests_workspace_model_timestamp` | model filters/analytics |
| `idx_requests_workspace_error_timestamp` | status/error filters |
| `idx_requests_workspace_id` | workspace-scoped counts/deletes |
| `idx_requests_route` | legacy route filtering |

## DB Rules

- Always parameterize values through `db.prepare`.
- Dynamic SQL columns must come from allowlists.
- Add schema changes in both `schema.ts` and `ensureSchemaUpdates()`.
- Normalize DB numeric aggregates before returning to frontend.
- Prefer `metadata` for rarely queried telemetry additions.
- Add first-class columns only when filtering, aggregating, or indexing is required.
- Never create analytics tables unless explicitly requested; derive from `requests`.

# SDK

Package: `sdk/`, published as `@zn_/tokenwatch`. It must remain dependency-free and support ESM/CJS builds.

## Public Surface

`sdk/src/index.ts` exports:

- `init`
- `track`
- `identify`
- `simulate`
- `startSimulation`
- `stopSimulation`
- `flush`
- `stats`
- `TokenWatch`
- transport stats/helpers
- public types from `types.ts`

## Lifecycle

1. `init(options)` requires `apiKey`.
2. Repeated `init()` resets transport and runtime state to avoid timers/identity/header leaks.
3. State lives in `state.ts`.
4. `track`, `identify`, and `simulate` create records in `generator.ts`.
5. `transport.ts` enqueues records in bounded queue.
6. Transport groups requests by API URL, endpoint, workspace ID, and headers.
7. If workspace ID is missing, transport calls `GET /api/me` with bearer API key and caches returned workspace ID.
8. Transport signs request headers via `security.ts`.
9. Transport POSTs to `/api/ingest` by default, retries retryable failures, flushes on shutdown.

## Key Files

| File | Owns |
|---|---|
| `client.ts` | public methods, simulation control, init reset |
| `transport.ts` | queue, batching, fetch, retry, signing, identity lookup, shutdown |
| `state.ts` | singleton config/identity/simulation state |
| `generator.ts` | track/identify/simulated record creation |
| `security.ts` | HMAC signed ingest headers |
| `types.ts` | public SDK contracts |
| `defaults.ts` | API URL/endpoint and simulation model profiles |
| `internal/queue.ts` | bounded queue |
| `internal/retryPolicy.ts` | error classification/backoff |
| `internal/shutdown.ts` | process/browser shutdown hooks |

## Defaults

- Endpoint: `/api/ingest`.
- Queue max: 1000.
- Batch size: 50.
- Flush interval: 25 ms.
- Retry attempts: 3.
- Timeout: 30000 ms.

## Protocol Pairings

| SDK | Backend |
|---|---|
| `security.ts createSignedHeaders` | `backend/src/utils/sdkAuth.ts verifySignedSdkRequest` |
| default `/api/ingest` | `backend/src/routes/ingest.ts` |
| batch `{ data: [...] }` | `ingestService.validateTelemetryPayload` |
| bearer API key `/api/me` lookup | `backend/src/routes/me.ts` |
| telemetry fields in `types.ts` | `backend/src/types/ingest.ts`, `ingestService.ts` |

## SDK Rules

- Do not add runtime dependencies.
- Keep queue bounded.
- Do not retry permanent 4xx errors.
- Keep shutdown flush best-effort and time-bounded.
- Preserve ESM/CJS build scripts.
- Treat `security.ts` as extremely dangerous; backend verifier must stay compatible.

# OpenClaw Integration

OpenClaw is the stateless Telegram bridge used by TokenWatch.
It receives Telegram updates, asks the TokenWatch backend to resolve workspace-scoped credentials, runs the correct intent, and sends a human-readable reply back to Telegram.

## Table Of Contents

- [Why OpenClaw Exists](#why-openclaw-exists)
- [Configuration](#configuration)
- [Webhook Flow](#webhook-flow)
- [Intent Routing](#intent-routing)
- [Tool Execution](#tool-execution)
- [How Telegram Reaches TokenWatch](#how-telegram-reaches-tokenwatch)
- [Request Lifecycle](#request-lifecycle)

## Why OpenClaw Exists

OpenClaw keeps the Telegram bridge separate from the main backend so the integration remains:

▪️ stateless
▪️ easy to deploy
▪️ easy to scale independently
▪️ isolated from customer bot secrets and workspace API keys

## Configuration

| Variable | Purpose |
|---|---|
| `TOKENWATCHER_API_URL` | TokenWatch backend URL |
| `OPENCLAW_INTERNAL_SECRET` | Shared secret used when resolving Telegram integrations |
| `OPENCLAW_PORT` | Local listen port |
| `OPENCLAW_HOST` | Bind address |
| `TOKENWATCHER_TIMEOUT_MS` | Backend request timeout |
| `TOKENWATCHER_USER_AGENT` | Outbound user agent string |
| `OPENCLAW_TELEGRAM_API_URL` | Optional Telegram API override for local testing |

OpenClaw does not need customer bot tokens or dashboard credentials on disk.

## Webhook Flow

1. Telegram sends an update to OpenClaw.
2. OpenClaw determines which integration the update belongs to.
3. OpenClaw calls `POST /api/integrations/telegram/webhook` on TokenWatch with the internal secret.
4. TokenWatch resolves the workspace, bot token, Telegram username, and OpenClaw API key for that request.
5. OpenClaw executes the matching tool.
6. OpenClaw renders the result and sends a Telegram reply.

## Intent Routing

The router converts user messages into tool calls such as:

▪️ `analytics.overview`
▪️ `analytics.models`
▪️ `analytics.endpoints`
▪️ `analytics.recent`
▪️ `report.get`
▪️ `forecast.full`
▪️ `forecast.budget`
▪️ `recommendations.list`
▪️ `requests.search`
▪️ `copilot.chat`

Examples of supported messages:

▪️ `Today's Spend`
▪️ `Top Models`
▪️ `Top Endpoints`
▪️ `Recommendations`
▪️ `Weekly report`
▪️ `Why did costs spike?`

## Tool Execution

OpenClaw talks back to TokenWatch through the API, not through direct database access.

Common endpoints:

▪️ `/api/workspaces/current`
▪️ `/api/analytics/snapshot`
▪️ `/api/analytics/overview`
▪️ `/api/analytics/models`
▪️ `/api/analytics/endpoints`
▪️ `/api/analytics/recent`
▪️ `/api/forecast`
▪️ `/api/forecast/budget`
▪️ `/api/reports/:type`
▪️ `/api/intelligence/recommendations`
▪️ `/api/requests`
▪️ `/api/copilot/chat`

## How Telegram Reaches TokenWatch

1. A user sends a message to the bot in Telegram.
2. Telegram delivers the update to OpenClaw.
3. OpenClaw requests the integration context from TokenWatch.
4. TokenWatch returns the workspace-scoped credentials for that chat.
5. OpenClaw uses those credentials to fetch analytics or reports.
6. The response is rendered into a Telegram reply.

## Request Lifecycle

▪️ Telegram update arrives.
▪️ OpenClaw resolves the integration.
▪️ TokenWatch authorizes the request with an internal secret.
▪️ OpenClaw executes the chosen analytics or Copilot tool.
▪️ OpenClaw sends the final message back to Telegram.

## Related Docs

▪️ [`telegram.md`](telegram.md)
▪️ [`api.md`](api.md)
▪️ [`security.md`](security.md)
▪️ [`deployment.md`](deployment.md)

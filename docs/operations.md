# Operations

This guide covers the operational surfaces that keep TokenWatch healthy in production.

## Table Of Contents

- [Logging](#logging)
- [Monitoring](#monitoring)
- [Health Checks](#health-checks)
- [Webhook Registration](#webhook-registration)
- [API Keys](#api-keys)
- [Secrets](#secrets)
- [Telemetry Storage](#telemetry-storage)

## Logging

TokenWatch logs are intentionally simple and structured around the service boundary:

▪️ backend logs auth, ingest, webhook, and scheduler events
▪️ OpenClaw logs webhook resolution, tool execution, and Telegram delivery
▪️ frontend surfaces operational state through the dashboard and SSE status

Keep an eye on:

▪️ authentication failures
▪️ ingest rate limiting
▪️ Telegram integration errors
▪️ webhook test failures
▪️ database connection errors

## Monitoring

Useful signals to monitor:

| Signal | Source |
|---|---|
| Backend health | `GET /api/health` |
| Active SSE connections | `GET /api/health` |
| Latest telemetry time | dashboard status header |
| Telegram integration status | `Settings -> Telegram Integration` |
| Request log freshness | `GET /api/requests` |
| OpenClaw request errors | OpenClaw logs |

## Health Checks

Primary health endpoint:

```bash
GET /api/health
```

It reports:

▪️ database connectivity
▪️ version information
▪️ environment name
▪️ active SSE connections
▪️ simulator state
▪️ telemetry row counts

OpenClaw should also be monitored with process-level health checks and log inspection.

## Webhook Registration

Telegram integration should be registered from the dashboard, not by hand.

Workflow:

1. Connect the bot in `Settings -> Telegram Integration`.
2. Let TokenWatch register the webhook for the connected bot.
3. Send the bot one message to initialize the chat.
4. Use `Test` to confirm message delivery.

## API Keys

API keys are workspace-scoped and must be treated as secrets.

Operational rules:

▪️ rotate SDK keys deliberately
▪️ revoke keys that are no longer used
▪️ avoid exposing plaintext secrets outside the create or rotate flow
▪️ verify key permissions before using them in automation

## Secrets

Secrets that must stay private:

▪️ JWT signing secret
▪️ database connection string
▪️ workspace encryption key
▪️ OpenClaw internal secret
▪️ BotFather token
▪️ Telegram bot token

## Telemetry Storage

The `requests` table is the canonical telemetry store.

Operational rules:

▪️ never write analytics into a separate shadow store unless the architecture changes deliberately
▪️ keep workspace filters on every query
▪️ keep exports intentionally capped
▪️ avoid unbounded request-log reads in the UI or API

## Related Docs

▪️ [`architecture.md`](architecture.md)
▪️ [`security.md`](security.md)
▪️ [`database.md`](database.md)

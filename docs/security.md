# Security

TokenWatch is designed around workspace isolation and secret minimization.

## Table Of Contents

- [Authentication](#authentication)
- [API Keys](#api-keys)
- [Workspace Isolation](#workspace-isolation)
- [Telegram Verification](#telegram-verification)
- [Webhook Secrets](#webhook-secrets)
- [Best Practices](#best-practices)

## Authentication

TokenWatch uses multiple auth models:

▪️ dashboard users authenticate with JWT cookies
▪️ SDK traffic authenticates with workspace API keys
▪️ OpenClaw uses an internal secret when resolving Telegram integrations
▪️ signed ingest can be enabled for stricter backend verification

## API Keys

API keys should be treated as server-side secrets.

Rules:

▪️ do not commit API keys into Git
▪️ do not expose production keys in browser code
▪️ rotate keys after suspicion of exposure
▪️ revoke unused keys
▪️ use the narrowest permission set that fits the integration

## Workspace Isolation

Every workspace-scoped read or write should filter by `workspace_id`.

That rule applies to:

▪️ telemetry ingestion
▪️ analytics queries
▪️ request logs
▪️ exports
▪️ reports
▪️ forecasts
▪️ intelligence and recommendations
▪️ Telegram integration data

## Telegram Verification

Telegram setup depends on two secrets:

▪️ the BotFather token
▪️ the Telegram bot token stored by TokenWatch and OpenClaw

Rules:

▪️ never share the BotFather token
▪️ never commit it to Git
▪️ verify the bot only from the dashboard
▪️ send the bot one message before testing delivery

## Webhook Secrets

OpenClaw and the backend share an internal secret for Telegram integration resolution.

Operational rules:

▪️ use a strong secret in production
▪️ keep the secret consistent between backend and OpenClaw
▪️ rotate the secret only with a coordinated rollout
▪️ do not confuse the internal secret with a customer bot token

## Best Practices

▪️ set `NODE_ENV=production` in production
▪️ use HTTPS in front of the dashboard and backend
▪️ set `CORS_ORIGIN` explicitly
▪️ keep `DATABASE_URL` private
▪️ keep `TOKENWATCHER_SECRET_ENCRYPTION_KEY` private
▪️ keep backups of production data
▪️ monitor for repeated auth failures or unusual Telegram activity

## Related Docs

▪️ [`deployment.md`](deployment.md)
▪️ [`operations.md`](operations.md)
▪️ [`telegram.md`](telegram.md)

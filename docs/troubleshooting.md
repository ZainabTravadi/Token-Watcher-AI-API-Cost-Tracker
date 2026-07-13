# Troubleshooting

This guide covers the most common issues users and contributors run into.

## Table Of Contents

- [SDK Not Sending Telemetry](#sdk-not-sending-telemetry)
- [Telegram Bot Not Responding](#telegram-bot-not-responding)
- [Webhook Issues](#webhook-issues)
- [Dashboard Empty](#dashboard-empty)
- [No Analytics](#no-analytics)
- [API Key Errors](#api-key-errors)
- [Database Connection Issues](#database-connection-issues)
- [Deployment Issues](#deployment-issues)

## SDK Not Sending Telemetry

Check:

▪️ the SDK was initialized with `TokenWatch.init(...)`
▪️ the API key is valid and active
▪️ `apiUrl` points to the backend you expect
▪️ `flush()` is called before shutdown in short-lived processes
▪️ the request is not being blocked by CORS or an upstream proxy

## Telegram Bot Not Responding

Check:

▪️ the bot was created through BotFather
▪️ the BotFather token was pasted correctly
▪️ the bot received at least one message from the user
▪️ the dashboard `Test` action was run after initialization
▪️ OpenClaw and the backend are both healthy

## Webhook Issues

Check:

▪️ the webhook URL is reachable from Telegram
▪️ the workspace has a valid Telegram integration
▪️ OpenClaw is using the same internal secret as the backend
▪️ reverse proxies are not blocking long-lived or outbound requests

## Dashboard Empty

Check:

▪️ you are on the correct workspace
▪️ the backend is writing telemetry to PostgreSQL
▪️ the frontend is pointing at the correct backend URL
▪️ filters are cleared
▪️ the request log has at least one row

## No Analytics

Check:

▪️ `requests` has rows for the workspace
▪️ the analytics endpoint is returning data
▪️ the backend is healthy
▪️ the dashboard SSE stream is connected
▪️ cache invalidation is happening after ingest

## API Key Errors

Check:

▪️ the API key starts from the expected workspace
▪️ the key has not been revoked
▪️ the key has not expired
▪️ the key has permission for the route you are calling
▪️ the client is sending the key in the expected header or auth context

## Database Connection Issues

Check:

▪️ `DATABASE_URL` is set
▪️ the URL is a PostgreSQL connection string
▪️ the database is reachable from the backend host
▪️ the credentials are valid
▪️ schema initialization completed successfully

## Deployment Issues

Check:

▪️ the backend release step ran successfully
▪️ the frontend points to the backend with `VITE_TOKENWATCH_API_URL`
▪️ OpenClaw has `TOKENWATCHER_API_URL` and `OPENCLAW_INTERNAL_SECRET`
▪️ production secrets are set and long enough
▪️ the health endpoint returns `ok`

## Related Docs

▪️ [`deployment.md`](deployment.md)
▪️ [`operations.md`](operations.md)
▪️ [`security.md`](security.md)

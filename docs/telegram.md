# Telegram Integration

This guide explains how to connect a Telegram bot to TokenWatch and what users can ask it once setup is complete.

## Table Of Contents

- [Create The Bot](#create-the-bot)
- [Connect In TokenWatch](#connect-in-tokenwatch)
- [Initialize The Chat](#initialize-the-chat)
- [Verify With Test](#verify-with-test)
- [Supported Commands](#supported-commands)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)

## Create The Bot

1. Open Telegram.
2. Search for `@BotFather`.
3. Start a chat with BotFather.
4. Send `/newbot`.
5. When prompted, enter a bot display name, for example `AI API Cost Tracker`.
6. When prompted again, enter a unique username ending in `bot`, for example `aiapicosttracker_bot`.
7. BotFather returns a private HTTP API token.
8. Copy the token and keep it private.

◻️ Screenshot placeholder: add a capture of the BotFather conversation here.

## Connect In TokenWatch

1. Open the TokenWatcher dashboard.
2. Go to `Settings -> Telegram Integration`.
3. Paste the BotFather token into the `Telegram Bot Token` field.
4. Click `Connect`.

## Initialize The Chat

After the connection succeeds:

1. Open your new bot in Telegram.
2. Send it any message, for example `Hello` or `/start`.
3. This initializes the chat so TokenWatch can reply back to the same conversation.

Important: the bot must receive at least one user message before `Test` can deliver messages.

## Verify With Test

1. Return to the dashboard.
2. Click `Test`.
3. Confirm that a test message arrives in Telegram.

## Supported Commands

TokenWatch maps natural messages to workspace actions. Common examples:

| Message | Result |
|---|---|
| `Today's Spend` | Shows current spend, request count, budget, and error rate |
| `Today's Summary` | Summarizes activity for the current day |
| `Top Models` | Lists the highest-spend models |
| `Top Endpoints` | Lists the highest-spend endpoints |
| `Recommendations` | Shows optimization suggestions |

You can also ask for reports, forecasts, recent requests, or Copilot-style explanations.

## Security Notes

▪️ Never share the BotFather token.
▪️ Never commit the BotFather token to Git.
▪️ Treat the token as full control of the bot.
▪️ Regenerate the bot and re-connect if the token is exposed.
▪️ Use workspace-scoped access only.

## Troubleshooting

▪️ If Test fails, confirm the bot received at least one message from the user.
▪️ If the bot is silent, check that the token was pasted into the correct workspace.
▪️ If Telegram cannot send replies, verify that OpenClaw and the backend are reachable.
▪️ If you are reconnecting after a token change, repeat the Connect step and send `/start` again.

## Related Docs

▪️ [`openclaw.md`](openclaw.md)
▪️ [`security.md`](security.md)
▪️ [`deployment.md`](deployment.md)

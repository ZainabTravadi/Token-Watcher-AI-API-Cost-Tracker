import { Router, type Response, type NextFunction } from "express";
import { getConfig } from "../config/env";
import { authenticateUser, type AuthenticatedRequest } from "../middleware/auth";
import { getWorkspace } from "../services/authService";
import {
  connectTelegramIntegration,
  deleteTelegramIntegration,
  getTelegramIntegrationStatus,
  regenerateTelegramOpenClawKey,
  resolveTelegramWebhook,
  testTelegramIntegration,
  verifyTelegramBotToken
} from "../services/telegramIntegrationService";
import { safeSecretEquals } from "../utils/secrets";

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;

function rateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const key = `${req.userId ?? "anonymous"}:${req.ip ?? "unknown"}:${req.path}`;
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    next();
    return;
  }
  current.count += 1;
  if (current.count > RATE_LIMIT) {
    res.status(429).json({ error: "Too many Telegram integration requests", retryAfterMs: current.resetAt - now });
    return;
  }
  next();
}

async function requireWorkspace(req: AuthenticatedRequest, res: Response): Promise<string | null> {
  const workspaceId = typeof req.body?.workspaceId === "string"
    ? req.body.workspaceId
    : typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) {
    res.status(400).json({ error: "Workspace ID required" });
    return null;
  }
  const workspace = await getWorkspace(workspaceId, req.userId!);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return null;
  }
  return workspace.id;
}

function requireInternalSecret(req: AuthenticatedRequest, res: Response): boolean {
  const configured = getConfig().openClawInternalSecret;
  if (!configured) {
    res.status(503).json({ error: "OpenClaw internal auth is not configured" });
    return false;
  }
  const received = typeof req.headers["x-openclaw-internal-secret"] === "string"
    ? req.headers["x-openclaw-internal-secret"]
    : null;
  if (!safeSecretEquals(configured, received)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

export function createTelegramIntegrationsRouter(): Router {
  const router = Router();

  router.post("/telegram/verify", authenticateUser, rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = await requireWorkspace(req, res);
      if (!workspaceId) return;
      const bot = await verifyTelegramBotToken(req.body?.botToken);
      res.status(200).json({ bot });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to verify Telegram bot" });
    }
  });

  router.post("/telegram/connect", authenticateUser, rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = await requireWorkspace(req, res);
      if (!workspaceId) return;
      const integration = await connectTelegramIntegration({
        workspaceId,
        userId: req.userId!,
        botToken: req.body?.botToken,
        webhookBaseUrl: typeof req.body?.webhookBaseUrl === "string" ? req.body.webhookBaseUrl : null
      });
      res.status(201).json({ integration });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to connect Telegram integration" });
    }
  });

  router.post("/telegram/test", authenticateUser, rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = await requireWorkspace(req, res);
      if (!workspaceId) return;
      res.status(200).json(await testTelegramIntegration(workspaceId, req.userId!));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to test Telegram integration" });
    }
  });

  router.get("/telegram/status", authenticateUser, rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = await requireWorkspace(req, res);
      if (!workspaceId) return;
      res.status(200).json({ integration: await getTelegramIntegrationStatus(workspaceId) });
    } catch {
      res.status(500).json({ error: "Failed to load Telegram integration status" });
    }
  });

  router.post("/telegram/regenerate-openclaw-key", authenticateUser, rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = await requireWorkspace(req, res);
      if (!workspaceId) return;
      res.status(200).json({ integration: await regenerateTelegramOpenClawKey(workspaceId, req.userId!) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to regenerate OpenClaw key" });
    }
  });

  router.delete("/telegram", authenticateUser, rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = await requireWorkspace(req, res);
      if (!workspaceId) return;
      const deleted = await deleteTelegramIntegration(workspaceId, req.userId!);
      res.status(deleted ? 200 : 404).json(deleted ? { ok: true } : { error: "Telegram integration not found" });
    } catch {
      res.status(500).json({ error: "Failed to disconnect Telegram integration" });
    }
  });

  router.post("/telegram/webhook", rateLimit, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!requireInternalSecret(req, res)) return;
      const integrationId = typeof req.body?.integrationId === "string" ? req.body.integrationId : "";
      const telegramSecret = typeof req.body?.telegramSecret === "string" ? req.body.telegramSecret : null;
      const rawChatId = req.body?.chatId;
      const chatId = typeof rawChatId === "number" && Number.isFinite(rawChatId)
        ? Math.trunc(rawChatId)
        : typeof rawChatId === "string" && rawChatId.trim()
          ? (() => {
              const parsed = Number(rawChatId);
              return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
            })()
          : null;
      if (!integrationId) {
        res.status(400).json({ error: "Integration ID required" });
        return;
      }
      const context = await resolveTelegramWebhook({ integrationId, telegramSecret, chatId });
      res.status(200).json({ context });
    } catch (error) {
      res.status(403).json({ error: error instanceof Error ? error.message : "Telegram webhook rejected" });
    }
  });

  return router;
}

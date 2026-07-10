import { Router, type Response } from "express";
import { getConfig } from "../config/env";
import { authenticateUser, authenticateWorkspaceAccess, type AuthenticatedRequest } from "../middleware/auth";
import {
  createWorkspace,
  deleteWorkspace,
  generateWorkspaceApiKey,
  getWorkspace,
  getWorkspaceApiKey,
  getWorkspaceSettings,
  getUserWorkspaces,
  listWorkspaceApiKeys,
  normalizeApiKeyPermissions,
  normalizeApiKeyType,
  regenerateWorkspaceApiKey,
  revokeWorkspaceApiKey,
  updateWorkspace,
  updateWorkspaceSettings,
} from "../services/authService";
import { getCurrentMonthSpend, getTelemetryCount } from "../services/telemetryRepository";
import {
  isValidNotificationEmail,
  sendDailyDigest,
  sendTestNotification,
  sendWeeklyExecutiveReport,
} from "../services/notificationService";

const WEBHOOK_TIMEOUT_MS = 5000;

// Validation helpers
function validateWorkspaceName(name: any): { valid: boolean; error?: string } {
  if (name === undefined || name === null) return { valid: true }; // Optional field
  if (typeof name !== "string") return { valid: false, error: "Workspace name must be a string" };
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: "Workspace name cannot be empty" };
  if (trimmed.length > 100) return { valid: false, error: "Workspace name must be 100 characters or less" };
  return { valid: true };
}

function validateMonthlyBudget(budget: any): { valid: boolean; error?: string } {
  if (budget === undefined || budget === null) return { valid: true }; // Optional field
  const num = typeof budget === "string" ? parseFloat(budget) : budget;
  if (typeof budget !== "number" && typeof budget !== "string") {
    return { valid: false, error: "Monthly budget must be a number" };
  }
  if (isNaN(num)) return { valid: false, error: "Monthly budget must be a valid number" };
  if (num < 0) return { valid: false, error: "Monthly budget must be positive" };
  if (num > 999999) return { valid: false, error: "Monthly budget must be less than 999,999" };
  return { valid: true };
}

function validateAlertCostThreshold(threshold: any): { valid: boolean; error?: string } {
  if (threshold === undefined || threshold === null) return { valid: true }; // Optional field
  const num = typeof threshold === "string" ? Number(threshold) : threshold;
  if (typeof threshold !== "number" && typeof threshold !== "string") {
    return { valid: false, error: "Cost threshold must be a number" };
  }
  if (!Number.isFinite(num)) return { valid: false, error: "Cost threshold must be a valid number" };
  if (!Number.isInteger(num)) return { valid: false, error: "Cost threshold must be a whole number" };
  if (num < 1) return { valid: false, error: "Cost threshold must be at least 1" };
  if (num > 100) return { valid: false, error: "Cost threshold must be 100 or less" };
  return { valid: true };
}

function validateLatencyThreshold(threshold: any): { valid: boolean; error?: string } {
  if (threshold === undefined || threshold === null) return { valid: true };
  const num = typeof threshold === "string" ? Number(threshold) : threshold;
  if (typeof threshold !== "number" && typeof threshold !== "string") return { valid: false, error: "Latency threshold must be a number" };
  if (!Number.isFinite(num)) return { valid: false, error: "Latency threshold must be a valid number" };
  if (!Number.isInteger(num)) return { valid: false, error: "Latency threshold must be a whole number" };
  if (num < 1) return { valid: false, error: "Latency threshold must be at least 1 ms" };
  if (num > 120000) return { valid: false, error: "Latency threshold must be 120000 ms or less" };
  return { valid: true };
}

function validateNotificationEmail(email: any): { valid: boolean; error?: string } {
  if (email === undefined || email === null || String(email).trim() === "") return { valid: true };
  return isValidNotificationEmail(String(email)) ? { valid: true } : { valid: false, error: "Enter a valid recipient email" };
}

function validateTimeValue(value: any, label: string): { valid: boolean; error?: string } {
  if (value === undefined || value === null) return { valid: true };
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? { valid: true }
    : { valid: false, error: `${label} must use HH:MM format` };
}

function validateTimezone(value: any): { valid: boolean; error?: string } {
  if (value === undefined || value === null) return { valid: true };
  if (typeof value !== "string" || !value.trim()) return { valid: false, error: "Timezone is required" };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return { valid: true };
  } catch {
    return { valid: false, error: "Enter a valid IANA timezone" };
  }
}

function validateWeekday(value: any): { valid: boolean; error?: string } {
  if (value === undefined || value === null) return { valid: true };
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(String(value))
    ? { valid: true }
    : { valid: false, error: "Weekly report day must be a weekday" };
}

function validateWebhookUrl(url: any): { valid: boolean; error?: string } {
  if (url === undefined || url === null) return { valid: true }; // Optional field
  if (typeof url !== "string") return { valid: false, error: "Webhook URL must be a string" };
  const trimmed = url.trim();
  if (!trimmed) return { valid: true }; // Empty is OK
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { valid: false, error: "Webhook URL must use http or https" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid webhook URL format" };
  }
}

async function buildWorkspaceUsage(workspaceId: string) {
  return {
    telemetry_count: await getTelemetryCount(workspaceId),
    current_month_spend: await getCurrentMonthSpend(workspaceId),
    api_version: getConfig().nodeEnv === "production" ? "v1" : "v1-dev",
    sdk_version: "0.1.4"
  };
}

export function createWorkspacesRouter(): Router {
  const router = Router();

  const getWorkspaceId = (req: AuthenticatedRequest): string | null => {
    return typeof req.params.id === "string" ? req.params.id : null;
  };

  /**
   * Create workspace
   * POST /api/workspaces
   */
  router.post("/", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const nameValidation = validateWorkspaceName(req.body?.name);
      if (!nameValidation.valid) {
        res.status(400).json({ error: nameValidation.error });
        return;
      }

      const created = await createWorkspace(req.userId!, String(req.body?.name ?? "New Workspace").trim());
      if (!created) {
        res.status(500).json({ error: "Failed to create workspace" });
        return;
      }

      const apiKey = await getWorkspaceApiKey(created.workspace.id);
      res.status(201).json({
        workspace: {
          ...created.workspace,
          apiKey: apiKey ? { id: apiKey.id, created_at: apiKey.created_at, value: created.apiKey } : null,
          settings: await getWorkspaceSettings(created.workspace.id),
        },
      });
    } catch (error) {
      console.error("[workspaces:create:error]", error);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  /**
   * List workspaces for authenticated user
   * GET /api/workspaces
   */
  router.get("/", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaces = await getUserWorkspaces(req.userId!);
      const withKeys = await Promise.all(workspaces.map(async (ws) => ({
        ...ws,
        apiKey: await getWorkspaceApiKey(ws.id),
        settings: await getWorkspaceSettings(ws.id),
      })));
      res.status(200).json(withKeys);
    } catch (error) {
      console.error("[workspaces:list:error]", error);
      res.status(500).json({ error: "Failed to list workspaces" });
    }
  });

  router.get("/current", authenticateWorkspaceAccess("workspace:read"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }
      const workspace = (req as any).workspace ?? await getWorkspace(req.workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      res.status(200).json({
        ...workspace,
        apiKey: req.authMethod === "api_key" ? null : await getWorkspaceApiKey(workspace.id),
        settings: await getWorkspaceSettings(workspace.id),
      });
    } catch (error) {
      console.error("[workspaces:current:error]", error);
      res.status(500).json({ error: "Failed to get workspace" });
    }
  });

  /**
   * Get single workspace
   * GET /api/workspaces/:id
   */
  router.get("/:id", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      res.status(200).json({
        ...workspace,
        apiKey: await getWorkspaceApiKey(workspace.id),
        settings: await getWorkspaceSettings(workspace.id),
      });
    } catch (error) {
      console.error("[workspaces:get:error]", error);
      res.status(500).json({ error: "Failed to get workspace" });
    }
  });

  /**
   * Update workspace settings
   * PUT /api/workspaces/:id
   */
  router.put("/:id", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const { name, monthly_budget, webhook_url } = req.body;

      // Validate name if provided
      if (name !== undefined) {
        const nameValidation = validateWorkspaceName(name);
        if (!nameValidation.valid) {
          res.status(400).json({ error: nameValidation.error });
          return;
        }
      }

      // Validate monthly_budget if provided
      if (monthly_budget !== undefined) {
        const budgetValidation = validateMonthlyBudget(monthly_budget);
        if (!budgetValidation.valid) {
          res.status(400).json({ error: budgetValidation.error });
          return;
        }
      }

      // Validate webhook_url if provided
      if (webhook_url !== undefined) {
        const webhookValidation = validateWebhookUrl(webhook_url);
        if (!webhookValidation.valid) {
          res.status(400).json({ error: webhookValidation.error });
          return;
        }
      }

      const updates: any = {};
      if (name !== undefined) updates.name = (name as string).trim();
      if (monthly_budget !== undefined) updates.monthly_budget = typeof monthly_budget === "string" ? parseFloat(monthly_budget) : monthly_budget;
      if (webhook_url !== undefined) updates.webhook_url = webhook_url ? (webhook_url as string).trim() : null;

      const updated = await updateWorkspace(workspaceId, req.userId!, updates);
      if (!updated) {
        res.status(500).json({ error: "Failed to update workspace" });
        return;
      }

      res.status(200).json({
        ...updated,
        apiKey: await getWorkspaceApiKey(updated.id),
        settings: await getWorkspaceSettings(updated.id),
      });
    } catch (error) {
      console.error("[workspaces:update:error]", error);
      res.status(500).json({ error: "Failed to update workspace" });
    }
  });

  /**
   * Update workspace settings (alerts, thresholds, etc.)
   * PUT /api/workspaces/:id/settings
   */
  router.put("/:id/settings", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const {
        alert_on_high_cost,
        alert_on_errors,
        alert_on_latency,
        daily_digest,
        weekly_report,
        alert_cost_threshold,
        latency_threshold_ms,
        notification_email,
        daily_digest_time,
        digest_timezone,
        weekly_report_day,
        weekly_report_time,
      } = req.body;

      if (alert_on_high_cost !== undefined && typeof alert_on_high_cost !== "boolean") {
        res.status(400).json({ error: "alert_on_high_cost must be a boolean" });
        return;
      }

      if (alert_on_errors !== undefined && typeof alert_on_errors !== "boolean") {
        res.status(400).json({ error: "alert_on_errors must be a boolean" });
        return;
      }

      if (alert_on_latency !== undefined && typeof alert_on_latency !== "boolean") {
        res.status(400).json({ error: "alert_on_latency must be a boolean" });
        return;
      }

      if (daily_digest !== undefined && typeof daily_digest !== "boolean") {
        res.status(400).json({ error: "daily_digest must be a boolean" });
        return;
      }

      if (weekly_report !== undefined && typeof weekly_report !== "boolean") {
        res.status(400).json({ error: "weekly_report must be a boolean" });
        return;
      }

      // Validate alert_cost_threshold if provided
      if (alert_cost_threshold !== undefined) {
        const thresholdValidation = validateAlertCostThreshold(alert_cost_threshold);
        if (!thresholdValidation.valid) {
          res.status(400).json({ error: thresholdValidation.error });
          return;
        }
      }

      if (latency_threshold_ms !== undefined) {
        const latencyValidation = validateLatencyThreshold(latency_threshold_ms);
        if (!latencyValidation.valid) {
          res.status(400).json({ error: latencyValidation.error });
          return;
        }
      }

      const emailValidation = validateNotificationEmail(notification_email);
      if (!emailValidation.valid) {
        res.status(400).json({ error: emailValidation.error });
        return;
      }
      const dailyTimeValidation = validateTimeValue(daily_digest_time, "Daily digest time");
      if (!dailyTimeValidation.valid) {
        res.status(400).json({ error: dailyTimeValidation.error });
        return;
      }
      const weeklyTimeValidation = validateTimeValue(weekly_report_time, "Weekly report time");
      if (!weeklyTimeValidation.valid) {
        res.status(400).json({ error: weeklyTimeValidation.error });
        return;
      }
      const timezoneValidation = validateTimezone(digest_timezone);
      if (!timezoneValidation.valid) {
        res.status(400).json({ error: timezoneValidation.error });
        return;
      }
      const weekdayValidation = validateWeekday(weekly_report_day);
      if (!weekdayValidation.valid) {
        res.status(400).json({ error: weekdayValidation.error });
        return;
      }

      const updates: any = {};
      if (alert_on_high_cost !== undefined) updates.alert_on_high_cost = alert_on_high_cost;
      if (alert_on_errors !== undefined) updates.alert_on_errors = alert_on_errors;
      if (alert_on_latency !== undefined) updates.alert_on_latency = alert_on_latency;
      if (daily_digest !== undefined) updates.daily_digest = daily_digest;
      if (weekly_report !== undefined) updates.weekly_report = weekly_report;
      if (alert_cost_threshold !== undefined) {
        const threshold = typeof alert_cost_threshold === "string" ? Number(alert_cost_threshold) : alert_cost_threshold;
        updates.alert_cost_threshold = threshold;
      }
      if (latency_threshold_ms !== undefined) {
        updates.latency_threshold_ms = typeof latency_threshold_ms === "string" ? Number(latency_threshold_ms) : latency_threshold_ms;
      }
      if (notification_email !== undefined) {
        const normalizedEmail = String(notification_email).trim().toLowerCase();
        const currentSettings = await getWorkspaceSettings(workspaceId);
        const currentEmail = currentSettings?.notification_email?.trim().toLowerCase() ?? null;
        const unchangedVerifiedEmail = Boolean(normalizedEmail && normalizedEmail === currentEmail && currentSettings?.email_verified);
        updates.notification_email = normalizedEmail || null;
        updates.email_verified = unchangedVerifiedEmail;
        if (!unchangedVerifiedEmail) updates.last_test_email_sent = null;
      }
      if (daily_digest_time !== undefined) updates.daily_digest_time = String(daily_digest_time).trim();
      if (digest_timezone !== undefined) updates.digest_timezone = String(digest_timezone).trim();
      if (weekly_report_day !== undefined) updates.weekly_report_day = String(weekly_report_day).trim();
      if (weekly_report_time !== undefined) updates.weekly_report_time = String(weekly_report_time).trim();

      const settings = await updateWorkspaceSettings(workspaceId, updates);
      if (!settings) {
        res.status(500).json({ error: "Failed to update settings" });
        return;
      }

      res.status(200).json(settings);
    } catch (error) {
      console.error("[workspaces:settings:error]", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  router.post("/:id/notifications/test-email", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const email = typeof req.body?.email === "string" ? req.body.email.trim() : undefined;
      if (email && !isValidNotificationEmail(email)) {
        res.status(400).json({ error: "Enter a valid recipient email" });
        return;
      }

      const result = await sendTestNotification(workspaceId, req.userId!, email);
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send test email";
      console.error("[workspaces:test-email:error]", message);
      res.status(502).json({ error: message });
    }
  });

  router.post("/:id/notifications/send-daily-digest", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }
      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      res.status(200).json(await sendDailyDigest(workspaceId, req.userId!));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send daily digest";
      console.error("[workspaces:daily-digest:error]", message);
      res.status(502).json({ error: message });
    }
  });

  router.post("/:id/notifications/send-weekly-report", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }
      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      res.status(200).json(await sendWeeklyExecutiveReport(workspaceId, req.userId!));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send weekly report";
      console.error("[workspaces:weekly-report:error]", message);
      res.status(502).json({ error: message });
    }
  });

  router.get("/:id/usage", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      res.status(200).json(await buildWorkspaceUsage(workspaceId));
    } catch (error) {
      console.error("[workspaces:usage:error]", error);
      res.status(500).json({ error: "Failed to load workspace usage" });
    }
  });

  router.post("/:id/webhook/test", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    const startedAt = Date.now();
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const url = typeof req.body?.url === "string" ? req.body.url.trim() : workspace.webhook_url?.trim();
      const validation = validateWebhookUrl(url);
      if (!url || !validation.valid) {
        res.status(400).json({ error: validation.error || "Webhook URL required" });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
      let status = "failure";
      let responseCode: number | null = null;
      let errorMessage: string | undefined;

      try {
        const webhookResponse = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "TokenWatch-Webhook-Test/1.0" },
          body: JSON.stringify({
            type: "tokenwatch.webhook.test",
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            timestamp: new Date().toISOString(),
            sample: true
          }),
          signal: controller.signal
        });
        responseCode = webhookResponse.status;
        status = webhookResponse.ok ? "success" : "failure";
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Webhook request failed";
      } finally {
        clearTimeout(timeout);
      }

      const testedAt = Date.now();
      const responseTime = testedAt - startedAt;
      await updateWorkspaceSettings(workspaceId, {
        webhook_last_test_at: testedAt,
        webhook_last_status: status,
        webhook_last_response_code: responseCode,
        webhook_last_response_time_ms: responseTime
      });

      res.status(200).json({
        success: status === "success",
        status,
        responseCode,
        responseTimeMs: responseTime,
        testedAt,
        ...(errorMessage ? { error: errorMessage } : {})
      });
    } catch (error) {
      console.error("[workspaces:webhook-test:error]", error);
      res.status(500).json({ error: "Failed to test webhook" });
    }
  });

  /**
   * Regenerate API key
   * POST /api/workspaces/:id/api-keys/regenerate
   */
  router.post("/:id/api-keys/regenerate", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";
      if (confirmation !== workspace.name) {
        res.status(400).json({ error: "Workspace name confirmation is required" });
        return;
      }

      const newKey = await regenerateWorkspaceApiKey(workspaceId);
      if (!newKey) {
        res.status(500).json({ error: "Failed to regenerate API key" });
        return;
      }

      const apiKey = await getWorkspaceApiKey(workspaceId);
      res.status(200).json({ apiKey: newKey, apiKeyMeta: apiKey });
    } catch (error) {
      console.error("[workspaces:regenerate-key:error]", error);
      res.status(500).json({ error: "Failed to regenerate API key" });
    }
  });

  router.get("/:id/api-keys", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      res.status(200).json({ apiKeys: await listWorkspaceApiKeys(workspaceId) });
    } catch (error) {
      console.error("[workspaces:list-keys:error]", error);
      res.status(500).json({ error: "Failed to list API keys" });
    }
  });

  router.post("/:id/api-keys", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const type = normalizeApiKeyType(req.body?.type);
      const permissions = normalizeApiKeyPermissions(type, req.body?.permissions);
      if (Array.isArray(req.body?.permissions) && permissions.length === 0) {
        res.status(400).json({ error: "No valid permissions are allowed for this API key type" });
        return;
      }
      const label = typeof req.body?.label === "string" ? req.body.label.trim() : `${type} key`;
      const expiresAt = req.body?.expires_at === null || req.body?.expires_at === undefined || req.body?.expires_at === ""
        ? null
        : Number(req.body.expires_at);
      if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
        res.status(400).json({ error: "Expiration must be a future timestamp" });
        return;
      }

      const apiKey = await generateWorkspaceApiKey({
        workspaceId,
        createdBy: req.userId!,
        label,
        type,
        permissions,
        expiresAt
      });
      const keys = await listWorkspaceApiKeys(workspaceId);
      const meta = keys[0] ?? null;
      res.status(201).json({ apiKey, apiKeyMeta: meta });
    } catch (error) {
      console.error("[workspaces:create-key:error]", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  router.post("/:id/api-keys/:keyId/revoke", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      const keyId = typeof req.params.keyId === "string" ? req.params.keyId : "";
      if (!workspaceId || !keyId) {
        res.status(400).json({ error: "Workspace ID and key ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const ok = await revokeWorkspaceApiKey(workspaceId, keyId);
      if (!ok) {
        res.status(404).json({ error: "API key not found or already revoked" });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[workspaces:revoke-key:error]", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  /**
   * Delete workspace
   * DELETE /api/workspaces/:id
   */
  router.delete("/:id", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = await getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";
      if (confirmation !== workspace.name) {
        res.status(400).json({ error: "Workspace name confirmation is required" });
        return;
      }

      const success = await deleteWorkspace(workspaceId, req.userId!);
      if (!success) {
        res.status(500).json({ error: "Failed to delete workspace" });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[workspaces:delete:error]", error);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  return router;
}

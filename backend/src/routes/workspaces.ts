import { Router, type Response } from "express";
import { authenticateUser, type AuthenticatedRequest } from "../middleware/auth";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceApiKey,
  getWorkspaceSettings,
  getUserWorkspaces,
  regenerateWorkspaceApiKey,
  updateWorkspace,
  updateWorkspaceSettings,
} from "../services/authService";

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

      const { alert_on_high_cost, alert_on_errors, alert_cost_threshold } = req.body;

      if (alert_on_high_cost !== undefined && typeof alert_on_high_cost !== "boolean") {
        res.status(400).json({ error: "alert_on_high_cost must be a boolean" });
        return;
      }

      if (alert_on_errors !== undefined && typeof alert_on_errors !== "boolean") {
        res.status(400).json({ error: "alert_on_errors must be a boolean" });
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

      const updates: any = {};
      if (alert_on_high_cost !== undefined) updates.alert_on_high_cost = alert_on_high_cost;
      if (alert_on_errors !== undefined) updates.alert_on_errors = alert_on_errors;
      if (alert_cost_threshold !== undefined) {
        const threshold = typeof alert_cost_threshold === "string" ? Number(alert_cost_threshold) : alert_cost_threshold;
        updates.alert_cost_threshold = threshold;
      }

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

      const newKey = await regenerateWorkspaceApiKey(workspaceId);
      if (!newKey) {
        res.status(500).json({ error: "Failed to regenerate API key" });
        return;
      }

      res.status(200).json({ apiKey: newKey });
    } catch (error) {
      console.error("[workspaces:regenerate-key:error]", error);
      res.status(500).json({ error: "Failed to regenerate API key" });
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

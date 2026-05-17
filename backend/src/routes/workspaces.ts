import { Router, type Request, type Response } from "express";
import { authenticateUser, type AuthenticatedRequest } from "../middleware/auth";
import {
  deleteWorkspace,
  generateWorkspaceApiKey,
  getWorkspace,
  getWorkspaceApiKey,
  getWorkspaceSettings,
  getUserWorkspaces,
  regenerateWorkspaceApiKey,
  updateWorkspace,
  updateWorkspaceSettings,
} from "../services/authService";

export function createWorkspacesRouter(): Router {
  const router = Router();

  const getWorkspaceId = (req: AuthenticatedRequest): string | null => {
    return typeof req.params.id === "string" ? req.params.id : null;
  };

  /**
   * List workspaces for authenticated user
   * GET /api/workspaces
   */
  router.get("/", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaces = getUserWorkspaces(req.userId!);
      const withKeys = workspaces.map((ws) => ({
        ...ws,
        apiKey: getWorkspaceApiKey(ws.id),
        settings: getWorkspaceSettings(ws.id),
      }));
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
  router.get("/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      res.status(200).json({
        ...workspace,
        apiKey: getWorkspaceApiKey(workspace.id),
        settings: getWorkspaceSettings(workspace.id),
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
  router.put("/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const { name, monthly_budget, webhook_url } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (monthly_budget !== undefined) updates.monthly_budget = monthly_budget;
      if (webhook_url !== undefined) updates.webhook_url = webhook_url;

      const updated = updateWorkspace(workspaceId, req.userId!, updates);
      if (!updated) {
        res.status(500).json({ error: "Failed to update workspace" });
        return;
      }

      res.status(200).json({
        ...updated,
        apiKey: getWorkspaceApiKey(updated.id),
        settings: getWorkspaceSettings(updated.id),
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
  router.put("/:id/settings", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const { alert_on_high_cost, alert_on_errors, alert_cost_threshold } = req.body;
      const updates: any = {};
      if (alert_on_high_cost !== undefined) updates.alert_on_high_cost = alert_on_high_cost;
      if (alert_on_errors !== undefined) updates.alert_on_errors = alert_on_errors;
      if (alert_cost_threshold !== undefined) updates.alert_cost_threshold = alert_cost_threshold;

      const settings = updateWorkspaceSettings(workspaceId, updates);
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
  router.post("/:id/api-keys/regenerate", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const newKey = regenerateWorkspaceApiKey(workspaceId);
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
  router.delete("/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" });
        return;
      }

      const workspace = getWorkspace(workspaceId, req.userId!);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const success = deleteWorkspace(workspaceId, req.userId!);
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

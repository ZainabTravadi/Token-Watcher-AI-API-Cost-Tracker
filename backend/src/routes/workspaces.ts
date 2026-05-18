import { Router, type Response } from "express";
import { authenticateUser, type AuthenticatedRequest } from "../middleware/auth";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceApiKey,
  getWorkspaceSettings,
  getUserWorkspaces,
  updateWorkspace,
} from "../services/authService";

export function createWorkspacesRouter(): Router {
  const router = Router();

  router.get("/", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaces = getUserWorkspaces(req.userId!);
      const withMeta = workspaces.map((workspace) => ({
        ...workspace,
        apiKey: getWorkspaceApiKey(workspace.id),
        settings: getWorkspaceSettings(workspace.id),
      }));
      res.status(200).json(withMeta);
    } catch (error) {
      console.error("[workspaces:list:error]", error);
      res.status(500).json({ error: "Failed to list workspaces" });
    }
  });

  router.post("/", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string") {
        res.status(400).json({ error: "Workspace name is required" });
        return;
      }

      const creation = createWorkspace(req.userId!, name);
      if (!creation) {
        res.status(500).json({ error: "Failed to create workspace" });
        return;
      }

      const settings = getWorkspaceSettings(creation.workspace.id);
      res.status(201).json({
        workspace: {
          ...creation.workspace,
          apiKey: creation.apiKey,
          settings,
        },
      });
    } catch (error) {
      console.error("[workspaces:create:error]", error);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  router.get("/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = typeof req.params.id === "string" ? req.params.id : null;
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

  router.patch("/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = typeof req.params.id === "string" ? req.params.id : null;
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
      const updates: Partial<Record<string, unknown>> = {};
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

  router.delete("/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = typeof req.params.id === "string" ? req.params.id : null;
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

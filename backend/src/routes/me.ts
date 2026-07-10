import { Router } from "express";
import { authenticateIdentity, type AuthenticatedRequest } from "../middleware/auth";
import { findUserById, getUserWorkspaces, getWorkspaceSettings } from "../services/authService";

export function createMeRouter(): Router {
  const router = Router();

  router.get("/me", authenticateIdentity, async (req: AuthenticatedRequest, res) => {
    try {
      const owner = req.userId ? await findUserById(req.userId) : null;

      if (req.authMethod === "api_key" && req.apiKey) {
        res.status(200).json({
          identity: {
            type: "api_key",
            key: {
              id: req.apiKey.keyId,
              type: req.apiKey.type,
              label: req.apiKey.label,
              permissions: req.apiKey.permissions,
              expires_at: req.apiKey.expiresAt
            },
            workspace: req.apiKey.workspace,
            organization: {
              id: req.apiKey.workspace.id,
              name: req.apiKey.workspace.name
            },
            owner: owner ? { id: owner.id, email: owner.email } : { id: req.apiKey.ownerId }
          }
        });
        return;
      }

      if (!owner) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const workspaces = await Promise.all((await getUserWorkspaces(owner.id)).map(async (workspace) => ({
        ...workspace,
        settings: await getWorkspaceSettings(workspace.id)
      })));

      res.status(200).json({
        identity: {
          type: "user",
          user: { id: owner.id, email: owner.email, created_at: owner.created_at },
          workspaces,
          session: {
            authenticated: true,
            status: "active",
            method: req.authMethod ?? "cookie",
            issued_at: req.sessionIssuedAt ?? null,
            expires_at: req.sessionExpiresAt ?? null
          }
        }
      });
    } catch (error) {
      console.error("[me:error]", error);
      res.status(500).json({ error: "Failed to get identity" });
    }
  });

  return router;
}

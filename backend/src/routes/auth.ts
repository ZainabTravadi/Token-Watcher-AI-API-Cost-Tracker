import { Router, type Request, type Response } from "express";
import { getConfig } from "../config/env";
import { getAuthClearCookieOptions, getAuthCookieName, getAuthCookieOptions } from "../config/cookies";
import { createJwt, verifyPassword } from "../utils/auth";
import {
  createUser,
  createWorkspace,
  findUserByEmail,
  findUserById,
  getWorkspaceApiKey,
  getWorkspaceSettings,
  getUserWorkspaces,
  setUserLastLogoutAt,
} from "../services/authService";
import { authenticateUser, type AuthenticatedRequest } from "../middleware/auth";

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * Sign up a new user
   * POST /api/auth/signup
   */
  router.post("/signup", (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password || password.length < 6) {
        res.status(400).json({ error: "Invalid email or password" });
        return;
      }

      const existing = findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "User already exists" });
        return;
      }

      const user = createUser(email, password);
      if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      // Create default workspace for new user
      const creation = createWorkspace(user.id, "Default Workspace");
      if (!creation) {
        res.status(500).json({ error: "Failed to create workspace" });
        return;
      }

      const settings = getWorkspaceSettings(creation.workspace.id);
      const apiKey = getWorkspaceApiKey(creation.workspace.id);

      // Create JWT token
      const config = getConfig();
      const token = createJwt(user.id, config.jwtSecret);

      res.cookie(getAuthCookieName(), token, getAuthCookieOptions(config));

      res.status(201).json({
        user: { id: user.id, email: user.email, created_at: user.created_at },
        workspace: {
          ...creation.workspace,
          apiKey: apiKey ? { id: creation.apiKey, created_at: apiKey.created_at } : null,
          settings,
        },
      });
    } catch (error) {
      console.error("[auth:signup:error]", error);
      res.status(500).json({ error: "Signup failed" });
    }
  });

  /**
   * Login
   * POST /api/auth/login
   */
  router.post("/login", (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Invalid email or password" });
        return;
      }

      const user = findUserByEmail(email);
      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Create JWT token
      const config = getConfig();
      const token = createJwt(user.id, config.jwtSecret);

      res.cookie(getAuthCookieName(), token, getAuthCookieOptions(config));

      const workspaces = getUserWorkspaces(user.id);
      const workspacesWithKeys = workspaces.map((ws) => {
        const apiKey = getWorkspaceApiKey(ws.id);
        const settings = getWorkspaceSettings(ws.id);
        return {
          ...ws,
          apiKey: apiKey ? { id: apiKey.id, created_at: apiKey.created_at } : null,
          settings,
        };
      });

      res.status(200).json({
        user: { id: user.id, email: user.email },
        workspaces: workspacesWithKeys,
      });
    } catch (error) {
      console.error("[auth:login:error]", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  /**
   * Logout
   * POST /api/auth/logout
   */
  router.post("/logout", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const config = getConfig();
    if (req.userId) {
      setUserLastLogoutAt(req.userId, Date.now());
    }
    res.clearCookie(getAuthCookieName(), getAuthClearCookieOptions(config));
    res.status(200).json({ ok: true });
  });

  /**
   * Get current user info
   * GET /api/auth/me
   */
  router.get("/me", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = findUserById(req.userId!);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Get user's workspaces with API key info
      const workspaces = getUserWorkspaces(user.id);
      const workspacesWithKeys = workspaces.map((ws) => {
        const apiKey = getWorkspaceApiKey(ws.id);
        const settings = getWorkspaceSettings(ws.id);
        return {
          ...ws,
          apiKey: apiKey ? { id: apiKey.id, created_at: apiKey.created_at } : null,
          settings,
        };
      });

      res.status(200).json({
        user: { id: user.id, email: user.email, created_at: user.created_at },
        workspaces: workspacesWithKeys,
      });
    } catch (error) {
      console.error("[auth:me:error]", error);
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  return router;
}

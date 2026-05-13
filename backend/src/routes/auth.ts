import { Router, type Request, type Response } from "express";
import { getConfig } from "../config/env";
import { createJwt, verifyPassword } from "../utils/auth";
import {
  createUser,
  createWorkspace,
  findUserByEmail,
  findUserById,
  generateWorkspaceApiKey,
  getWorkspaceApiKey,
  getWorkspaceSettings,
  getUserWorkspaces,
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
      const workspace = createWorkspace(user.id, "Default Workspace");
      if (!workspace) {
        res.status(500).json({ error: "Failed to create workspace" });
        return;
      }

      // Generate initial API key
      const apiKey = generateWorkspaceApiKey(workspace.id);

      // Create JWT token
      const config = getConfig();
      const token = createJwt(user.id, config.jwtSecret);

      res.cookie("tokenwatch_auth", token, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const settings = getWorkspaceSettings(workspace.id);

      res.status(201).json({
        user: { id: user.id, email: user.email, created_at: user.created_at },
        workspace: {
          ...workspace,
          apiKey: apiKey ? { id: apiKey.id, created_at: apiKey.created_at } : null,
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

      res.cookie("tokenwatch_auth", token, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        user: { id: user.id, email: user.email },
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
  router.post("/logout", (req: Request, res: Response) => {
    res.clearCookie("tokenwatch_auth");
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

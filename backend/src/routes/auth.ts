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

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 12;
const SIGNUP_LIMIT = 5;
const authAttempts = new Map<string, { count: number; resetAt: number }>();
let lastAuthAttemptCleanup = 0;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return null;
  }
  return email;
}

function validatePassword(value: unknown): string | null {
  if (typeof value !== "string") {
    return "Password is required";
  }
  if (value.length < 12) {
    return "Password must be at least 12 characters";
  }
  if (value.length > 128) {
    return "Password must be 128 characters or less";
  }
  if (!/[A-Za-z]/u.test(value) || !/[0-9]/u.test(value)) {
    return "Password must include at least one letter and one number";
  }
  return null;
}

function checkAuthRateLimit(req: Request, scope: "login" | "signup", email: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  if (now - lastAuthAttemptCleanup > AUTH_WINDOW_MS) {
    lastAuthAttemptCleanup = now;
    for (const [key, value] of authAttempts) {
      if (value.resetAt <= now) {
        authAttempts.delete(key);
      }
    }
  }

  const ip = String(req.ip ?? req.headers["x-forwarded-for"] ?? "local");
  const key = `${scope}:${ip}:${email}`;
  const limit = scope === "login" ? LOGIN_LIMIT : SIGNUP_LIMIT;
  const current = authAttempts.get(key);

  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return { allowed: true };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  return { allowed: true };
}

function buildSession() {
  const now = Date.now();
  return {
    authenticated: true,
    status: "active",
    method: "cookie",
    issued_at: now,
    expires_at: now + 30 * 24 * 60 * 60 * 1000
  };
}

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * Sign up a new user
   * POST /api/auth/signup
   */
  router.post("/signup", async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;

      if (!email) {
        res.status(400).json({ error: "Enter a valid email address" });
        return;
      }

      const rateLimit = checkAuthRateLimit(req, "signup", email);
      if (!rateLimit.allowed) {
        res.status(429).json({ error: "Too many signup attempts", retryAfterMs: rateLimit.retryAfterMs });
        return;
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        res.status(400).json({ error: passwordError });
        return;
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "User already exists" });
        return;
      }

      const user = await createUser(email, password);
      if (!user) {
        res.status(409).json({ error: "User already exists" });
        return;
      }

      // Create default workspace for new user
      const creation = await createWorkspace(user.id, "Default Workspace");
      if (!creation) {
        res.status(500).json({ error: "Failed to create workspace" });
        return;
      }

      const settings = await getWorkspaceSettings(creation.workspace.id);
      const apiKey = await getWorkspaceApiKey(creation.workspace.id);

      // Create JWT token
      const config = getConfig();
      const token = createJwt(user.id, config.jwtSecret);

      res.cookie(getAuthCookieName(), token, getAuthCookieOptions(config));

      res.status(201).json({
        user: { id: user.id, email: user.email, created_at: user.created_at },
        workspace: {
          ...creation.workspace,
          apiKey: apiKey ? { id: apiKey.id, created_at: apiKey.created_at, value: creation.apiKey } : null,
          settings,
        },
        session: buildSession(),
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
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;

      if (!email || typeof password !== "string") {
        res.status(400).json({ error: "Invalid email or password" });
        return;
      }

      const rateLimit = checkAuthRateLimit(req, "login", email);
      if (!rateLimit.allowed) {
        res.status(429).json({ error: "Too many login attempts", retryAfterMs: rateLimit.retryAfterMs });
        return;
      }

      const user = await findUserByEmail(email);
      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Create JWT token
      const config = getConfig();
      const token = createJwt(user.id, config.jwtSecret);

      res.cookie(getAuthCookieName(), token, getAuthCookieOptions(config));

      const workspaces = await getUserWorkspaces(user.id);
      const workspacesWithKeys = await Promise.all(workspaces.map(async (ws) => {
        const apiKey = await getWorkspaceApiKey(ws.id);
        const settings = await getWorkspaceSettings(ws.id);
        return {
          ...ws,
          apiKey: apiKey ? { id: apiKey.id, created_at: apiKey.created_at } : null,
          settings,
        };
      }));

      res.status(200).json({
        user: { id: user.id, email: user.email },
        workspaces: workspacesWithKeys,
        session: buildSession(),
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
  router.post("/logout", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    const config = getConfig();
    if (req.userId) {
      await setUserLastLogoutAt(req.userId, Date.now());
    }
    res.clearCookie(getAuthCookieName(), getAuthClearCookieOptions(config));
    res.status(200).json({ ok: true });
  });

  /**
   * Get current user info
   * GET /api/auth/me
   */
  router.get("/me", authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await findUserById(req.userId!);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Get user's workspaces with API key info
      const workspaces = await getUserWorkspaces(user.id);
      const workspacesWithKeys = await Promise.all(workspaces.map(async (ws) => {
        const apiKey = await getWorkspaceApiKey(ws.id);
        const settings = await getWorkspaceSettings(ws.id);
        return {
          ...ws,
          apiKey: apiKey ? { id: apiKey.id, created_at: apiKey.created_at } : null,
          settings,
        };
      }));

      res.status(200).json({
        user: { id: user.id, email: user.email, created_at: user.created_at },
        workspaces: workspacesWithKeys,
        session: {
          authenticated: true,
          status: "active",
          method: req.authMethod ?? "cookie",
          issued_at: req.sessionIssuedAt ?? null,
          expires_at: req.sessionExpiresAt ?? null,
        },
      });
    } catch (error) {
      console.error("[auth:me:error]", error);
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  return router;
}

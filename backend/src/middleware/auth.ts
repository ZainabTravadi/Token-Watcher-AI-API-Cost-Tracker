import { type Request, type Response, type NextFunction } from "express";
import { getConfig } from "../config/env";
import { verifyJwt } from "../utils/auth";
import { getUserLastLogoutAt, getUserWorkspaces, getWorkspace, verifyApiKey } from "../services/authService";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  workspaceId?: string;
  authMethod?: "cookie" | "bearer";
  sessionIssuedAt?: number;
  sessionExpiresAt?: number;
}

/**
 * Middleware to authenticate user via JWT cookie or Authorization header only
 */
export async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = getConfig();
    
    // Check for JWT in cookie or Authorization header only
    let token = req.cookies?.["tokenwatch_auth"];
    let authMethod: "cookie" | "bearer" = "cookie";
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7);
      authMethod = "bearer";
    }

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const decoded = verifyJwt(token, config.jwtSecret);
    if (!decoded) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const lastLogoutAt = await getUserLastLogoutAt(decoded.userId);
    if (decoded.iat * 1000 < lastLogoutAt) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.userId = decoded.userId;
    req.authMethod = authMethod;
    req.sessionIssuedAt = decoded.iat * 1000;
    req.sessionExpiresAt = decoded.exp * 1000;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Middleware to authenticate SDK via API key header
 */
export async function authenticateSDK(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey || typeof apiKey !== "string") {
      res.status(401).json({ error: "Missing API key" });
      return;
    }

    const result = await verifyApiKey(apiKey);
    if (!result) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    req.workspaceId = result.workspaceId;
    (req as any).workspace = result.workspace;
    next();
  } catch (error) {
    res.status(500).json({ error: "API key validation error" });
  }
}

/**
 * Optional workspace attachment - sets workspaceId from query/body if provided
 * Used for routes that may or may not require workspace context
 */
export function attachWorkspaceOptional(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const workspaceId = req.query.workspaceId || req.body?.workspaceId;
  if (workspaceId && typeof workspaceId === "string") {
    req.workspaceId = workspaceId;
  }
  next();
}

export async function requireOwnedWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const requestedWorkspaceId =
    (typeof req.params.workspaceId === "string" ? req.params.workspaceId : undefined) ||
    (typeof req.params.id === "string" ? req.params.id : undefined) ||
    (typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined) ||
    (typeof req.body?.workspaceId === "string" ? req.body.workspaceId : undefined);

  const workspaceId = requestedWorkspaceId || (await getUserWorkspaces(req.userId))[0]?.id;

  if (!workspaceId) {
    res.status(400).json({ error: "Workspace ID required" });
    return;
  }

  const workspace = await getWorkspace(workspaceId, req.userId);
  if (!workspace) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  req.workspaceId = workspace.id;
  (req as any).workspace = workspace;
  next();
}

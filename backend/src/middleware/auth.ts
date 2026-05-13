import { type Request, type Response, type NextFunction } from "express";
import { getConfig } from "../config/env";
import { verifyJwt } from "../utils/auth";
import { verifyApiKey } from "../services/authService";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  workspaceId?: string;
}

/**
 * Middleware to authenticate user via JWT cookie or Authorization header
 */
export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const config = getConfig();
    
    // Check for JWT in cookie or Authorization header
    let token = req.cookies?.["tokenwatch_auth"];
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7);
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

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Middleware to authenticate SDK via API key header
 */
export function authenticateSDK(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const apiKey = req.headers["x-api-key"] || req.query.apiKey;

    if (!apiKey || typeof apiKey !== "string") {
      res.status(401).json({ error: "Missing API key" });
      return;
    }

    const result = verifyApiKey(apiKey);
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

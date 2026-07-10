import { type Request, type Response, type NextFunction } from "express";
import { getConfig } from "../config/env";
import { verifyJwt } from "../utils/auth";
import {
  getUserLastLogoutAt,
  getUserWorkspaces,
  getWorkspace,
  hasApiKeyPermission,
  readApiKeyTypeFromKey,
  verifyApiKey,
  type ApiKeyIdentity,
  type ApiKeyPermission
} from "../services/authService";
import { verifySignedSdkRequest } from "../utils/sdkAuth";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  workspaceId?: string;
  authMethod?: "cookie" | "api_key";
  apiKey?: ApiKeyIdentity;
  sessionIssuedAt?: number;
  sessionExpiresAt?: number;
  rawBody?: string;
}

/**
 * Middleware to authenticate a human dashboard user via JWT cookie.
 */
export async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = getConfig();
    
    const token = req.cookies?.["tokenwatch_auth"];

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
    req.authMethod = "cookie";
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
    const config = getConfig();
    const apiKey = readApiKey(req);

    if (!apiKey) {
      res.status(401).json({ error: "Missing API key" });
      return;
    }

    const result = await verifyApiKey(apiKey);
    if (!result) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    if (!hasApiKeyPermission(result, "telemetry:ingest")) {
      res.status(403).json({ error: "API key is not allowed to ingest telemetry" });
      return;
    }

    const signatureResult = verifySignedSdkRequest(req, apiKey, result.workspaceId, {
      required: config.requireSignedIngest,
      toleranceMs: config.ingestSignatureToleranceMs
    });
    if (!signatureResult.ok) {
      res.status(401).json({ error: signatureResult.error });
      return;
    }

    req.workspaceId = result.workspaceId;
    req.userId = result.ownerId;
    req.apiKey = result;
    req.authMethod = "api_key";
    (req as any).workspace = result.workspace;
    next();
  } catch (error) {
    res.status(500).json({ error: "API key validation error" });
  }
}

export function requireApiKeyPermission(permission: ApiKeyPermission) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = readApiKey(req);
      if (!apiKey) {
        res.status(401).json({ error: "Missing API key" });
        return;
      }

      const identity = await verifyApiKey(apiKey);
      if (!identity) {
        res.status(401).json({ error: "Invalid API key" });
        return;
      }

      if (!hasApiKeyPermission(identity, permission)) {
        res.status(403).json({ error: "API key does not have the required permission" });
        return;
      }

      req.userId = identity.ownerId;
      req.workspaceId = identity.workspaceId;
      req.apiKey = identity;
      req.authMethod = "api_key";
      (req as any).workspace = identity.workspace;
      next();
    } catch {
      res.status(500).json({ error: "API key validation error" });
    }
  };
}

export function authenticateWorkspaceAccess(permission: ApiKeyPermission) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (readApiKey(req)) {
      await requireApiKeyPermission(permission)(req, res, next);
      return;
    }

    await authenticateUser(req, res, async () => {
      await requireOwnedWorkspace(req, res, next);
    });
  };
}

export async function authenticateIdentity(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = readApiKey(req);
  if (!apiKey) {
    await authenticateUser(req, res, next);
    return;
  }

  try {
    const identity = await verifyApiKey(apiKey);
    if (!identity) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    req.userId = identity.ownerId;
    req.workspaceId = identity.workspaceId;
    req.apiKey = identity;
    req.authMethod = "api_key";
    (req as any).workspace = identity.workspace;
    next();
  } catch {
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
  if (req.authMethod === "api_key" && req.workspaceId) {
    next();
    return;
  }

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

function readApiKey(req: AuthenticatedRequest): string | null {
  const xApiKey = req.headers["x-api-key"];
  if (typeof xApiKey === "string" && xApiKey.trim()) {
    return xApiKey.trim();
  }

  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    return readApiKeyTypeFromKey(token) ? token : null;
  }

  return null;
}

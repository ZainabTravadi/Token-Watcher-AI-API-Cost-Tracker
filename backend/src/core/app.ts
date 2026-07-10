import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "../routes";
import { getConfig } from "../config/env";

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/u, "");
}

export function createApp(): Express {
  const app = express();
  const config = getConfig();
  const allowedOrigins = new Set(config.corsOrigin.map(normalizeOrigin));

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Middleware
  app.use(cookieParser());
  app.use(express.json({
    limit: "1mb",
    verify: (request, _response, buffer) => {
      (request as { rawBody?: string }).rawBody = buffer.toString("utf8");
    }
  }));

  app.use((_request, response, next) => {
    response.header("X-Content-Type-Options", "nosniff");
    response.header("Referrer-Policy", "no-referrer");
    response.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    next();
  });

  // CORS
  app.use((request, response, next) => {
    const requestOrigin =
      typeof request.headers.origin === "string"
        ? request.headers.origin
        : "";

    const normalizedRequestOrigin = requestOrigin
      ? normalizeOrigin(requestOrigin)
      : "";

    const allowOrigin =
      normalizedRequestOrigin.length > 0 &&
      allowedOrigins.has(normalizedRequestOrigin);

    if (allowOrigin) {
      response.header(
        "Access-Control-Allow-Origin",
        normalizedRequestOrigin
      );
      response.header("Vary", "Origin");

      response.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );

      response.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, X-API-Key, X-TokenWatch-Workspace, X-TokenWatch-Timestamp, X-TokenWatch-Nonce, X-TokenWatch-Signature"
      );

      response.header(
        "Access-Control-Expose-Headers",
        "X-TokenWatch-Status"
      );

      response.header(
        "Access-Control-Allow-Credentials",
        "true"
      );
    }

    if (request.method === "OPTIONS") {
      response.sendStatus(allowOrigin ? 204 : 403);
      return;
    }

    next();
  });

  registerRoutes(app);

  return app;
}

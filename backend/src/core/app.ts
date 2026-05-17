import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "../routes";
import { getConfig } from "../config/env";

export function createApp(): Express {
  const app = express();
  const config = getConfig();
  const allowedOrigins = new Set(config.corsOrigin);

  app.disable("x-powered-by");
  
  // Middleware
  app.use(cookieParser());
  app.use(express.json());

  // CORS
  app.use((request, response, next) => {
    const requestOrigin = request.headers.origin;

    const allowOrigin = Boolean(requestOrigin && allowedOrigins.has(requestOrigin));
    const allowedOriginValue = requestOrigin ?? "";

    // Set CORS headers only if origin is allowed
    if (allowOrigin) {
      response.header("Access-Control-Allow-Origin", allowedOriginValue);
      response.header("Vary", "Origin");

      response.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );
      response.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, X-API-Key"
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
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "../routes";
import { getConfig } from "../config/env";

export function createApp(): Express {
  const app = express();
  const config = getConfig();

  app.disable("x-powered-by");
  
  // Middleware
  app.use(cookieParser());
  app.use(express.json());

  // CORS
  app.use((request, response, next) => {
    const allowedOrigin = config.corsOrigin;
    const requestOrigin = request.headers.origin;

    // Always set CORS headers for matching origins or wildcard
    if (allowedOrigin === "*") {
      response.header("Access-Control-Allow-Origin", "*");
    } else if (requestOrigin && (requestOrigin === allowedOrigin || allowedOrigin === "*")) {
      response.header("Access-Control-Allow-Origin", requestOrigin);
    }

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

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });

  registerRoutes(app);

  return app;
}
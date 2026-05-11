import express, { type Express } from "express";
import { registerRoutes } from "../routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN ?? "*";
    const requestOrigin = request.headers.origin;

    response.header("Access-Control-Allow-Origin", allowedOrigin === "*" ? "*" : allowedOrigin);
    response.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    response.header("Access-Control-Expose-Headers", "X-TokenWatch-Status");

    if (allowedOrigin !== "*" && requestOrigin && requestOrigin !== allowedOrigin) {
      response.header("Access-Control-Allow-Origin", allowedOrigin);
    }

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json());

  registerRoutes(app);

  return app;
}
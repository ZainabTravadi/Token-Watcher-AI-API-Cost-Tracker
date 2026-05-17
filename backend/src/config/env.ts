import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
  jwtSecret: string;
  corsOrigin: string[];
}

export function getConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-key-please-set-in-production";

  const defaultCorsOrigins = [
    "http://localhost:3000", // webpack dev server
    "http://localhost:5173", // Vite
    "http://localhost:8080", // current dev server
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
  ];

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : defaultCorsOrigins;
  
  return {
    port: Number.parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
    databasePath: process.env.DATABASE_PATH ?? "./data/tokenwatch.sqlite",
    jwtSecret,
    corsOrigin
  };
}
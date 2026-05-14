import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
  jwtSecret: string;
  corsOrigin: string | string[];
}

export function getConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-key-please-set-in-production";
  
  // Support multiple frontend ports for development
  // Default to common Vite and webpack dev server ports
  const corsOrigin = process.env.CORS_ORIGIN ?? [
    "http://localhost:3000",  // webpack dev server
    "http://localhost:5173",  // Vite
    "http://localhost:8080",  // legacy/fallback
  ];
  
  return {
    port: Number.parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
    databasePath: process.env.DATABASE_PATH ?? "./data/tokenwatch.sqlite",
    jwtSecret,
    corsOrigin
  };
}
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
  jwtSecret: string;
  corsOrigin: string;
}

export function getConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-key-please-set-in-production";
  
  return {
    port: Number.parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
    databasePath: process.env.DATABASE_PATH ?? "./data/tokenwatch.sqlite",
    jwtSecret,
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:8080"
  };
}
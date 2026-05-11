import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
}

export function getConfig(): AppConfig {
  return {
    port: Number.parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
    databasePath: process.env.DATABASE_PATH ?? "./data/tokenwatch.sqlite"
  };
}
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
  jwtSecret: string;
  corsOrigin: string[];
  enableSimulators: boolean;
}

const DEV_JWT_SECRET = "dev-secret-key-please-set-in-production";
const MINIMUM_JWT_SECRET_LENGTH = 32;
const TRUTHY_BOOLEAN_STRINGS = new Set(["1", "true", "yes", "on"]);

function parseBoolean(value?: string): boolean {
  if (!value) {
    return false;
  }
  return TRUTHY_BOOLEAN_STRINGS.has(value.trim().toLowerCase());
}

export function getConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET ?? DEV_JWT_SECRET;

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

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const enableSimulators = process.env.ENABLE_SIMULATORS !== undefined
    ? parseBoolean(process.env.ENABLE_SIMULATORS)
    : nodeEnv === "development";

  if (
    nodeEnv === "production" &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET || process.env.JWT_SECRET.length < MINIMUM_JWT_SECRET_LENGTH)
  ) {
    throw new Error(
      "JWT_SECRET must be set to a strong secret in production. Set process.env.JWT_SECRET to a secure, random string with at least 32 characters."
    );
  }
  if (nodeEnv === "production" && process.env.ENABLE_SIMULATORS !== undefined && parseBoolean(process.env.ENABLE_SIMULATORS)) {
    // Warn operators if simulators are explicitly enabled in production
    // This is intentionally a console.warn not an error to avoid preventing startup when operator explicitly overrides.
    // Keep message concise and actionable.
    // eslint-disable-next-line no-console
    console.warn("[startup] WARNING: ENABLE_SIMULATORS is true in production — simulators will run. Ensure this is intentional.");
  }
  
  return {
    port: Number.parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv,
    databasePath: process.env.DATABASE_PATH ?? "./data/tokenwatch.sqlite",
    jwtSecret,
    corsOrigin,
    enableSimulators
  };
}

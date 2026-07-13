import dotenv from "dotenv";
import path from "path";

// Load backend/.env by default so modules using getConfig()
// get the same DATABASE_URL regardless of the current working directory.
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigin: string[];
  enableSimulators: boolean;
  resendApiKey: string | null;
  resendFromEmail: string;
  appUrl: string;
  openClawPublicUrl: string | null;
  openClawInternalSecret: string | null;
  telegramApiUrl: string;
  secretEncryptionKey: string;
  requireSignedIngest: boolean;
  ingestSignatureToleranceMs: number;
}

const DEV_JWT_SECRET = "dev-secret-key-please-set-in-production";
const MINIMUM_JWT_SECRET_LENGTH = 32;
const DEV_ENCRYPTION_KEY = "dev-tokenwatch-secret-encryption-key";
const DEV_OPENCLAW_INTERNAL_SECRET = "dev-openclaw-internal-secret-please-set-in-production";
const MINIMUM_OPENCLAW_SECRET_LENGTH = 32;
const TRUTHY_BOOLEAN_STRINGS = new Set(["1", "true", "yes", "on"]);

function parseBoolean(value?: string): boolean {
  if (!value) {
    return false;
  }
  return TRUTHY_BOOLEAN_STRINGS.has(value.trim().toLowerCase());
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/u, "");
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
    ? process.env.CORS_ORIGIN.split(",").map((origin) => normalizeOrigin(origin)).filter(Boolean)
    : defaultCorsOrigins.map(normalizeOrigin);

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

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. TokenWatcher supports PostgreSQL only.");
  }
  if (!/^postgres(?:ql)?:\/\//iu.test(databaseUrl)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
  }
  if (nodeEnv === "production" && !process.env.CORS_ORIGIN) {
    throw new Error("CORS_ORIGIN is required in production and must list the allowed frontend origin(s).");
  }
  const secretEncryptionKey = process.env.TOKENWATCHER_SECRET_ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY;
  if (nodeEnv === "production" && (!process.env.TOKENWATCHER_SECRET_ENCRYPTION_KEY || secretEncryptionKey.length < 32)) {
    throw new Error("TOKENWATCHER_SECRET_ENCRYPTION_KEY must be set to a secure 32+ character secret in production.");
  }
  const openClawInternalSecret = process.env.OPENCLAW_INTERNAL_SECRET?.trim() || DEV_OPENCLAW_INTERNAL_SECRET;
  if (nodeEnv === "production" && (!process.env.OPENCLAW_INTERNAL_SECRET || openClawInternalSecret.length < MINIMUM_OPENCLAW_SECRET_LENGTH)) {
    throw new Error("OPENCLAW_INTERNAL_SECRET must be set to a secure 32+ character infrastructure secret in production.");
  }
  
  return {
    port: Number.parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv,
    databaseUrl,
    jwtSecret,
    corsOrigin,
    enableSimulators,
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "TokenWatcher <notifications@tokenwatch.local>",
    appUrl: process.env.APP_URL ?? "http://localhost:8080",
    openClawPublicUrl: process.env.OPENCLAW_PUBLIC_URL?.trim().replace(/\/+$/u, "") || null,
    openClawInternalSecret,
    telegramApiUrl: (process.env.OPENCLAW_TELEGRAM_API_URL?.trim() || process.env.TELEGRAM_API_URL?.trim() || "https://api.telegram.org").replace(/\/+$/u, ""),
    secretEncryptionKey,
    requireSignedIngest: parseBoolean(process.env.TOKENWATCH_REQUIRE_SIGNED_INGEST),
    ingestSignatureToleranceMs: parsePositiveInteger(process.env.TOKENWATCH_INGEST_SIGNATURE_TOLERANCE_MS, 300000)
  };
}

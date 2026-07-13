import path from "node:path";
import { loadEnvFiles } from "./loadEnv";

const openClawRoot = path.resolve(__dirname, "..", "..");
loadEnvFiles(openClawRoot);

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface OpenClawConfig {
  host: string;
  port: number;
  logLevel: LogLevel;
  telegramApiUrl: string;
  tokenWatcherApiUrl: string;
  openClawInternalSecret: string;
  runtimeApiKey?: string;
  tokenWatcherTimeoutMs: number;
  tokenWatcherUserAgent: string;
}

const DEV_OPENCLAW_INTERNAL_SECRET = "dev-openclaw-internal-secret-please-set-in-production";
const MINIMUM_OPENCLAW_SECRET_LENGTH = 32;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseLogLevel(value: string | undefined): LogLevel {
  switch ((value ?? "").toLowerCase()) {
    case "debug":
    case "info":
    case "warn":
    case "error":
      return value!.toLowerCase() as LogLevel;
    default:
      return "info";
  }
}

export function getConfig(): OpenClawConfig {
  const nodeEnv = (process.env.NODE_ENV ?? "development").trim().toLowerCase();
  const openClawInternalSecret = process.env.OPENCLAW_INTERNAL_SECRET?.trim() || DEV_OPENCLAW_INTERNAL_SECRET;

  if (nodeEnv === "production" && (!process.env.OPENCLAW_INTERNAL_SECRET || openClawInternalSecret.length < MINIMUM_OPENCLAW_SECRET_LENGTH)) {
    throw new Error("OPENCLAW_INTERNAL_SECRET must be set to a secure 32+ character infrastructure secret in production.");
  }

  return {
    host: process.env.OPENCLAW_HOST?.trim() || "0.0.0.0",
    port: parsePort(process.env.PORT ?? process.env.OPENCLAW_PORT, 3300),
    logLevel: parseLogLevel(process.env.OPENCLAW_LOG_LEVEL),
    telegramApiUrl: (process.env.OPENCLAW_TELEGRAM_API_URL?.trim() || "https://api.telegram.org").replace(/\/+$/u, ""),
    tokenWatcherApiUrl: required("TOKENWATCHER_API_URL").replace(/\/+$/u, ""),
    openClawInternalSecret,
    tokenWatcherTimeoutMs: parseTimeout(process.env.TOKENWATCHER_TIMEOUT_MS, 60000),
    tokenWatcherUserAgent: process.env.TOKENWATCHER_USER_AGENT?.trim() || "OpenClaw-TokenWatcher/1.0"
  };
}

import path from "node:path";
import { loadEnvFiles } from "./loadEnv";

const openClawRoot = path.resolve(__dirname, "..", "..");
loadEnvFiles(openClawRoot);

export type TokenWatcherAuthMode = "login" | "bearer";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface OpenClawConfig {
  host: string;
  port: number;
  logLevel: LogLevel;
  telegramBotToken: string;
  telegramSecretToken: string | null;
  telegramApiUrl: string;
  tokenWatcherApiUrl: string;
  tokenWatcherAuthMode: TokenWatcherAuthMode;
  tokenWatcherJwt: string | null;
  tokenWatcherEmail: string | null;
  tokenWatcherPassword: string | null;
  tokenWatcherWorkspaceId: string | null;
  tokenWatcherTimeoutMs: number;
  tokenWatcherUserAgent: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
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

function parseAuthMode(): TokenWatcherAuthMode {
  const explicit = process.env.TOKENWATCHER_AUTH_MODE?.trim().toLowerCase();
  if (explicit === "login" || explicit === "bearer") {
    return explicit;
  }

  if (process.env.TOKENWATCHER_JWT?.trim()) {
    return "bearer";
  }

  return "login";
}

export function getConfig(): OpenClawConfig {
  const tokenWatcherAuthMode = parseAuthMode();
  const tokenWatcherJwt = optional("TOKENWATCHER_JWT");
  const tokenWatcherEmail = optional("TOKENWATCHER_EMAIL");
  const tokenWatcherPassword = optional("TOKENWATCHER_PASSWORD");

  if (tokenWatcherAuthMode === "bearer" && !tokenWatcherJwt) {
    throw new Error("TOKENWATCHER_JWT is required when TOKENWATCHER_AUTH_MODE=bearer");
  }

  if (tokenWatcherAuthMode === "login" && (!tokenWatcherEmail || !tokenWatcherPassword)) {
    throw new Error("TOKENWATCHER_EMAIL and TOKENWATCHER_PASSWORD are required when TOKENWATCHER_AUTH_MODE=login");
  }

  return {
    host: process.env.OPENCLAW_HOST?.trim() || "127.0.0.1",
    port: parsePort(process.env.OPENCLAW_PORT, 3300),
    logLevel: parseLogLevel(process.env.OPENCLAW_LOG_LEVEL),
    telegramBotToken: required("OPENCLAW_TELEGRAM_BOT_TOKEN"),
    telegramSecretToken: optional("OPENCLAW_TELEGRAM_SECRET_TOKEN"),
    telegramApiUrl: (process.env.OPENCLAW_TELEGRAM_API_URL?.trim() || "https://api.telegram.org").replace(/\/+$/u, ""),
    tokenWatcherApiUrl: required("TOKENWATCHER_API_URL").replace(/\/+$/u, ""),
    tokenWatcherAuthMode,
    tokenWatcherJwt,
    tokenWatcherEmail,
    tokenWatcherPassword,
    tokenWatcherWorkspaceId: optional("TOKENWATCHER_WORKSPACE_ID"),
    tokenWatcherTimeoutMs: parseTimeout(process.env.TOKENWATCHER_TIMEOUT_MS, 60000),
    tokenWatcherUserAgent: process.env.TOKENWATCHER_USER_AGENT?.trim() || "OpenClaw-TokenWatcher/phase3a"
  };
}

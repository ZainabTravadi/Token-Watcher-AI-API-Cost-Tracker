import type { CookieOptions } from "express";
import type { AppConfig } from "./env";

const AUTH_COOKIE_NAME = "tokenwatch_auth";
const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isProduction(config: AppConfig): boolean {
  return config.nodeEnv === "production";
}

function authCookieBaseOptions(config: AppConfig): CookieOptions {
  if (isProduction(config)) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    };
  }

  return {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  };
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getAuthCookieOptions(config: AppConfig): CookieOptions {
  return {
    ...authCookieBaseOptions(config),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

export function getAuthClearCookieOptions(config: AppConfig): CookieOptions {
  return authCookieBaseOptions(config);
}

import { URL } from "node:url";
import type { Logger } from "../logger";
import type { OpenClawConfig } from "../config/env";

interface RequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  authenticated?: boolean;
  retryOnUnauthorized?: boolean;
}

interface LoginResponse {
  workspaces?: Array<{ id: string }>;
}

export class TokenWatcherClient {
  private readonly config: OpenClawConfig;
  private readonly logger: Logger;
  private jwt: string | null;
  private inferredWorkspaceId: string | null;

  constructor(config: OpenClawConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.jwt = config.tokenWatcherAuthMode === "bearer" ? config.tokenWatcherJwt : null;
    this.inferredWorkspaceId = config.tokenWatcherWorkspaceId;
  }

  async getWorkspaceId(): Promise<string | null> {
    if (this.inferredWorkspaceId) {
      return this.inferredWorkspaceId;
    }

    if (this.config.tokenWatcherAuthMode === "login") {
      await this.ensureJwt();
      return this.inferredWorkspaceId;
    }

    return null;
  }

  async getJson<T>(route: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const options: RequestOptions = {
      method: "GET",
      authenticated: true,
      retryOnUnauthorized: true
    };
    if (query) {
      options.query = query;
    }
    return this.requestJson<T>(route, options);
  }

  async postJson<T>(route: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const options: RequestOptions = {
      method: "POST",
      authenticated: true,
      retryOnUnauthorized: true
    };
    if (body !== undefined) {
      options.body = body;
    }
    if (query) {
      options.query = query;
    }
    return this.requestJson<T>(route, options);
  }

  private async requestJson<T>(route: string, options: RequestOptions): Promise<T> {
    const url = new URL(`${this.config.tokenWatcherApiUrl}${route}`);
    const query = { ...(options.query ?? {}) };

    if (options.authenticated) {
      const workspaceId = await this.getWorkspaceId();
      if (workspaceId && !query.workspaceId && route !== "/api/workspaces") {
        query.workspaceId = workspaceId;
      }
    }

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers({
      "Accept": "application/json",
      "User-Agent": this.config.tokenWatcherUserAgent
    });

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (options.authenticated) {
      const jwt = await this.ensureJwt();
      headers.set("Authorization", `Bearer ${jwt}`);
    }

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
      signal: AbortSignal.timeout(this.config.tokenWatcherTimeoutMs)
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);

    if (response.status === 401 && options.retryOnUnauthorized && this.config.tokenWatcherAuthMode === "login") {
      this.logger.warn("tokenwatcher.auth.retry", { route });
      this.jwt = null;
      await this.ensureJwt(true);
      return this.requestJson<T>(route, { ...options, retryOnUnauthorized: false });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TokenWatcher API ${options.method ?? "GET"} ${route} failed with ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private async ensureJwt(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.jwt) {
      return this.jwt;
    }

    if (this.config.tokenWatcherAuthMode === "bearer") {
      if (!this.config.tokenWatcherJwt) {
        throw new Error("TOKENWATCHER_JWT is not configured");
      }
      this.jwt = this.config.tokenWatcherJwt;
      return this.jwt;
    }

    const response = await fetch(`${this.config.tokenWatcherApiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": this.config.tokenWatcherUserAgent
      },
      body: JSON.stringify({
        email: this.config.tokenWatcherEmail,
        password: this.config.tokenWatcherPassword
      }),
      signal: AbortSignal.timeout(this.config.tokenWatcherTimeoutMs)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TokenWatcher login failed with ${response.status}: ${text}`);
    }

    const cookieHeader = response.headers.get("set-cookie") || response.headers.get("Set-Cookie");
    const match = cookieHeader?.match(/tokenwatch_auth=([^;]+)/u);
    if (!match?.[1]) {
      throw new Error("TokenWatcher login succeeded but no tokenwatch_auth cookie was returned");
    }

    const body = await response.json() as LoginResponse;
    this.jwt = match[1];
    if (!this.inferredWorkspaceId) {
      this.inferredWorkspaceId = body.workspaces?.[0]?.id ?? null;
    }

    this.logger.info("tokenwatcher.auth.login", {
      workspaceId: this.inferredWorkspaceId
    });

    return this.jwt;
  }
}

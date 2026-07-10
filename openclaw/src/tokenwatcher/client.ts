import { URL } from "node:url";
import type { Logger } from "../logger";
import type { OpenClawConfig } from "../config/env";

interface RequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

export class TokenWatcherClient {
  private readonly config: OpenClawConfig;
  private readonly logger: Logger;

  constructor(config: OpenClawConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async getJson<T>(route: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const options: RequestOptions = {
      method: "GET"
    };
    if (query) {
      options.query = query;
    }
    return this.requestJson<T>(route, options);
  }

  async postJson<T>(route: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const options: RequestOptions = {
      method: "POST"
    };
    if (body !== undefined) {
      options.body = body;
    }
    if (query) {
      options.query = query;
    }
    return this.requestJson<T>(route, options);
  }

  async getIdentity(): Promise<{
    identity?: {
      type?: string;
      key?: {
        type?: string;
        label?: string;
        permissions?: string[];
        expires_at?: number | null;
      };
      workspace?: { id?: string; name?: string };
      organization?: { id?: string; name?: string };
      owner?: { id?: string; email?: string };
    };
  }> {
    return this.getJson("/api/me");
  }

  private async requestJson<T>(route: string, options: RequestOptions): Promise<T> {
    const url = new URL(`${this.config.tokenWatcherApiUrl}${route}`);
    const query = { ...(options.query ?? {}) };

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers({
      "Accept": "application/json",
      "User-Agent": this.config.tokenWatcherUserAgent,
      "Authorization": `Bearer ${this.config.tokenWatcherApiKey}`
    });

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
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

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TokenWatcher API ${options.method ?? "GET"} ${route} failed with ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }
}

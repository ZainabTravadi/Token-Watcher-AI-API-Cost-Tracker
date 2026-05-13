import { DEFAULT_SIMULATION_INTERVAL_MS, MODEL_PROFILES, ROUTE_MODEL_MAP, ROUTE_WEIGHTS, normalizeProvider, modelProvider } from "./defaults.js";
import type { TokenWatchIdentity, TokenWatchSimulationOptions, TokenWatchTelemetryRecord } from "./types.js";

export function createTrackRecord(name: string, workspaceId: string, identity: TokenWatchIdentity | null, options: { timestamp?: number; properties?: Record<string, unknown> } = {}): TokenWatchTelemetryRecord {
  const timestamp = options.timestamp ?? Date.now();

  return {
    id: createId(),
    workspace_id: workspaceId,
    timestamp,
    event: name,
    route: `/events/${slugify(name)}`,
    provider: "TokenWatch",
    model: "custom-event",
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    error: null,
    identity: identity ? { ...identity, traits: identity.traits ? { ...identity.traits } : undefined } : undefined,
    properties: options.properties ? { ...options.properties } : undefined
  };
}

export function createIdentifyRecord(id: string, workspaceId: string, traits?: Record<string, unknown>): TokenWatchTelemetryRecord {
  return {
    id: createId(),
    workspace_id: workspaceId,
    timestamp: Date.now(),
    event: "identify",
    route: "/identify",
    provider: "TokenWatch",
    model: "identity",
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    error: null,
    identity: {
      id,
      traits: traits ? { ...traits } : undefined
    }
  };
}

export function createSimulationRecord(workspaceId: string, identity: TokenWatchIdentity | null, options: TokenWatchSimulationOptions = {}): TokenWatchTelemetryRecord {
  const route = options.endpoint ?? pickWeighted(ROUTE_WEIGHTS);
  const requestedModel = options.model ?? pickWeighted(ROUTE_MODEL_MAP[route] ?? ROUTE_MODEL_MAP["/api/chat"]);
  const provider = normalizeProvider(options.provider, requestedModel);
  const model = requestedModel;
  const profile = MODEL_PROFILES[model] ?? fallbackProfile(provider);
  const timestamp = Date.now() - randomInt(0, options.jitterMs ?? 9000);
  const routeScale = routeScaleFactor(route);
  const variance = 0.85 + Math.random() * 0.45;

  const inputTokens = Math.max(1, Math.round(randomInt(profile.inputRange[0], profile.inputRange[1]) * routeScale * variance));
  const outputTokens = Math.max(0, Math.round(randomInt(profile.outputRange[0], profile.outputRange[1]) * routeScale * variance));
  const totalTokens = inputTokens + outputTokens;
  const latencyMs = Math.max(28, Math.round(profile.baseLatency * variance + totalTokens / 4));
  const costUsd = roundCost((inputTokens / 1_000) * profile.inputCostPerK + (outputTokens / 1_000) * profile.outputCostPerK);
  const error = generateError(route, model);

  return {
    id: createId(),
    workspace_id: workspaceId,
    timestamp,
    event: "simulate",
    route,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    latency_ms: latencyMs,
    error,
    identity: identity ? { ...identity, traits: identity.traits ? { ...identity.traits } : undefined } : undefined,
    properties: options.properties ? { ...options.properties } : undefined
  };
}

export function defaultSimulationIntervalMs(value?: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 100) {
    return Math.round(value);
  }

  return DEFAULT_SIMULATION_INTERVAL_MS;
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tw_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function pickWeighted<T extends { value: string; weight: number }>(items: ReadonlyArray<T>): string {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.value;
    }
  }

  return items[0]?.value ?? "/api/chat";
}

function routeScaleFactor(route: string): number {
  switch (route) {
    case "/api/chat":
      return 1.1;
    case "/api/summarize":
      return 1.25;
    case "/api/search":
      return 0.55;
    case "/api/autocomplete":
      return 0.3;
    case "/api/agents":
      return 1.6;
    default:
      return 1;
  }
}

function fallbackProfile(provider: string): { provider: string; inputRange: [number, number]; outputRange: [number, number]; baseLatency: number; inputCostPerK: number; outputCostPerK: number } {
  return provider.toLowerCase() === "anthropic"
    ? {
        provider: modelProvider("claude-sonnet") ?? "Anthropic",
        inputRange: [700, 2200],
        outputRange: [200, 1200],
        baseLatency: 900,
        inputCostPerK: 0.003,
        outputCostPerK: 0.012
      }
    : {
        provider: modelProvider("gpt-4o") ?? "OpenAI",
        inputRange: [500, 2000],
        outputRange: [120, 900],
        baseLatency: 650,
        inputCostPerK: 0.002,
        outputCostPerK: 0.008
      };
}

function generateError(route: string, model: string): string | null {
  const errorRoll = Math.random();
  const baseErrorRate = route === "/api/autocomplete" ? 0.012 : route === "/api/search" ? 0.018 : route === "/api/chat" ? 0.022 : route === "/api/summarize" ? 0.028 : 0.034;

  if (errorRoll > baseErrorRate) {
    return null;
  }

  const rateLimitChance = model === "gpt-4o-mini" || model === "claude-haiku" ? 0.6 : 0.35;
  if (Math.random() < rateLimitChance) {
    return `HTTP_429_RATE_LIMIT:${route}`;
  }

  return `HTTP_500_UPSTREAM_ERROR:${route}`;
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "event";
}
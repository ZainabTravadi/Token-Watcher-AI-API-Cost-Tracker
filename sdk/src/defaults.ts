import type { TokenWatchProvider } from "./types.js";

export const DEFAULT_API_URL = "http://localhost:4000";
export const DEFAULT_ENDPOINT = "/api/ingest";
export const DEFAULT_PROJECT_ID = "default";
export const DEFAULT_SIMULATION_INTERVAL_MS = 4000;

export const MODEL_PROFILES: Record<string, { provider: string; inputRange: [number, number]; outputRange: [number, number]; baseLatency: number; inputCostPerK: number; outputCostPerK: number }> = {
  "gpt-4o": {
    provider: "OpenAI",
    inputRange: [850, 2600],
    outputRange: [240, 1400],
    baseLatency: 820,
    inputCostPerK: 0.005,
    outputCostPerK: 0.015
  },
  "gpt-4o-mini": {
    provider: "OpenAI",
    inputRange: [180, 1100],
    outputRange: [120, 900],
    baseLatency: 420,
    inputCostPerK: 0.00015,
    outputCostPerK: 0.0006
  },
  "claude-sonnet": {
    provider: "Anthropic",
    inputRange: [900, 2800],
    outputRange: [300, 1600],
    baseLatency: 980,
    inputCostPerK: 0.003,
    outputCostPerK: 0.015
  },
  "claude-haiku": {
    provider: "Anthropic",
    inputRange: [140, 900],
    outputRange: [80, 700],
    baseLatency: 360,
    inputCostPerK: 0.00025,
    outputCostPerK: 0.00125
  }
};

export const ROUTE_WEIGHTS = [
  { value: "/api/chat", weight: 38 },
  { value: "/api/summarize", weight: 14 },
  { value: "/api/search", weight: 20 },
  { value: "/api/autocomplete", weight: 17 },
  { value: "/api/agents", weight: 11 }
] as const;

export const ROUTE_MODEL_MAP: Record<string, Array<{ value: string; weight: number }>> = {
  "/api/chat": [
    { value: "gpt-4o", weight: 56 },
    { value: "gpt-4o-mini", weight: 28 },
    { value: "claude-sonnet", weight: 12 },
    { value: "claude-haiku", weight: 4 }
  ],
  "/api/summarize": [
    { value: "claude-sonnet", weight: 48 },
    { value: "gpt-4o", weight: 32 },
    { value: "gpt-4o-mini", weight: 14 },
    { value: "claude-haiku", weight: 6 }
  ],
  "/api/search": [
    { value: "gpt-4o-mini", weight: 42 },
    { value: "claude-haiku", weight: 30 },
    { value: "gpt-4o", weight: 16 },
    { value: "claude-sonnet", weight: 12 }
  ],
  "/api/autocomplete": [
    { value: "gpt-4o-mini", weight: 58 },
    { value: "claude-haiku", weight: 34 },
    { value: "gpt-4o", weight: 5 },
    { value: "claude-sonnet", weight: 3 }
  ],
  "/api/agents": [
    { value: "gpt-4o", weight: 38 },
    { value: "claude-sonnet", weight: 37 },
    { value: "gpt-4o-mini", weight: 15 },
    { value: "claude-haiku", weight: 10 }
  ]
};

export function normalizeProvider(provider: TokenWatchProvider | undefined, model?: string): string {
  const inferred = model ? modelProvider(model) : undefined;
  const normalized = String(provider ?? inferred ?? "openai").toLowerCase();

  if (normalized === "openai") {
    return "OpenAI";
  }

  if (normalized === "anthropic") {
    return "Anthropic";
  }

  return provider ? String(provider) : inferred ?? "TokenWatch";
}

export function modelProvider(model: string): string | undefined {
  return MODEL_PROFILES[model]?.provider;
}
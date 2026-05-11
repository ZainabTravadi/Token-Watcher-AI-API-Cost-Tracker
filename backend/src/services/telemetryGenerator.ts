import type {
  SimulatedTelemetryRecord,
  TelemetryModel,
  TelemetryProvider,
  TelemetryRoute
} from "../types/telemetry";
import { clamp, gaussianish, randomFloat, randomInt, weightedPick } from "../utils/random";

type ModelProfile = {
  model: TelemetryModel;
  provider: TelemetryProvider;
  inputRange: [number, number];
  outputRange: [number, number];
  baseLatency: number;
  inputCostPerK: number;
  outputCostPerK: number;
};

const routeWeights: Array<{ value: TelemetryRoute; weight: number }> = [
  { value: "/api/chat", weight: 38 },
  { value: "/api/summarize", weight: 14 },
  { value: "/api/search", weight: 20 },
  { value: "/api/autocomplete", weight: 17 },
  { value: "/api/agents", weight: 11 }
];

const modelProfiles: Record<TelemetryModel, ModelProfile> = {
  "gpt-4o": {
    model: "gpt-4o",
    provider: "OpenAI",
    inputRange: [850, 2600],
    outputRange: [240, 1400],
    baseLatency: 820,
    inputCostPerK: 0.005,
    outputCostPerK: 0.015
  },
  "gpt-4o-mini": {
    model: "gpt-4o-mini",
    provider: "OpenAI",
    inputRange: [180, 1100],
    outputRange: [120, 900],
    baseLatency: 420,
    inputCostPerK: 0.00015,
    outputCostPerK: 0.0006
  },
  "claude-sonnet": {
    model: "claude-sonnet",
    provider: "Anthropic",
    inputRange: [900, 2800],
    outputRange: [300, 1600],
    baseLatency: 980,
    inputCostPerK: 0.003,
    outputCostPerK: 0.015
  },
  "claude-haiku": {
    model: "claude-haiku",
    provider: "Anthropic",
    inputRange: [140, 900],
    outputRange: [80, 700],
    baseLatency: 360,
    inputCostPerK: 0.00025,
    outputCostPerK: 0.00125
  }
};

const routeModelMap: Record<TelemetryRoute, Array<{ value: TelemetryModel; weight: number }>> = {
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

export function generateTelemetryRecord(timestamp = Date.now()): Omit<SimulatedTelemetryRecord, "id"> {
  const route = weightedPick(routeWeights);
  const model = weightedPick(routeModelMap[route]);
  const profile = modelProfiles[model];
  const trend = dailyTrendFactor(new Date(timestamp));
  const spikeFactor = trafficSpikeFactor(new Date(timestamp));
  const volumeFactor = clamp(trend * spikeFactor, 0.35, 2.8);

  const baseInput = randomInt(profile.inputRange[0], profile.inputRange[1]);
  const routeMultiplier = routeInputMultiplier(route);
  const inputTokens = Math.max(1, Math.round(baseInput * routeMultiplier * volumeFactor));
  const outputTokens = Math.max(0, Math.round(randomInt(profile.outputRange[0], profile.outputRange[1]) * routeOutputMultiplier(route) * volumeFactor));
  const totalTokens = inputTokens + outputTokens;

  const latencyNoise = gaussianish(0, profile.baseLatency * 0.12);
  const latencyMs = Math.max(32, Math.round(profile.baseLatency * volumeFactor + totalTokens / 4 + latencyNoise));

  const costUsd = roundCost((inputTokens / 1_000) * profile.inputCostPerK + (outputTokens / 1_000) * profile.outputCostPerK);
  const error = generateError(route, model, volumeFactor);

  return {
    timestamp: jitterTimestamp(timestamp),
    route,
    model,
    provider: profile.provider,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    latency_ms: latencyMs,
    error
  };
}

export function generateTelemetryBatch(now = Date.now(), count = 1): Array<Omit<SimulatedTelemetryRecord, "id">> {
  return Array.from({ length: count }, (_, index) => generateTelemetryRecord(now - index * randomInt(120, 12_000)));
}

export function estimateBurstSize(now = new Date()): number {
  const hourFactor = dailyTrendFactor(now);
  const spikeFactor = trafficSpikeFactor(now);
  const baseline = randomInt(1, 3);
  return Math.max(1, Math.round(baseline * hourFactor * spikeFactor));
}

export function generateHistoricalDataset(days = 7): Array<Omit<SimulatedTelemetryRecord, "id">> {
  const events: Array<Omit<SimulatedTelemetryRecord, "id">> = [];
  const end = Date.now();
  const start = end - days * 24 * 60 * 60 * 1000;

  for (let ts = start; ts < end; ts += randomInt(12_000, 45_000)) {
    const burst = estimateBurstSize(new Date(ts));
    events.push(...generateTelemetryBatch(ts, burst));
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function routeInputMultiplier(route: TelemetryRoute): number {
  switch (route) {
    case "/api/chat":
      return randomFloat(0.9, 1.4);
    case "/api/summarize":
      return randomFloat(1.2, 1.9);
    case "/api/search":
      return randomFloat(0.35, 0.85);
    case "/api/autocomplete":
      return randomFloat(0.2, 0.55);
    case "/api/agents":
      return randomFloat(1.4, 2.4);
  }
}

function routeOutputMultiplier(route: TelemetryRoute): number {
  switch (route) {
    case "/api/chat":
      return randomFloat(0.9, 1.5);
    case "/api/summarize":
      return randomFloat(1.0, 1.8);
    case "/api/search":
      return randomFloat(0.05, 0.15);
    case "/api/autocomplete":
      return randomFloat(0.08, 0.25);
    case "/api/agents":
      return randomFloat(1.2, 2.0);
  }
}

function dailyTrendFactor(date: Date): number {
  const hour = date.getHours();
  const weekday = date.getDay();
  const dayCurve = 0.7 + 0.35 * Math.sin(((hour - 8) / 24) * Math.PI * 2) + 0.2 * Math.sin(((hour - 17) / 24) * Math.PI * 2);
  const weekdayFactor = weekday === 0 || weekday === 6 ? 0.7 : weekday >= 1 && weekday <= 4 ? 1.15 : 1.0;
  return clamp(dayCurve * weekdayFactor, 0.45, 1.85);
}

function trafficSpikeFactor(date: Date): number {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const checkpointSpike = minute === 0 || minute === 15 || minute === 30 || minute === 45 ? 1.45 : 1;
  const launchSpike = hour >= 9 && hour <= 11 ? 1.25 : 1;
  const randomSpike = Math.random() < 0.05 ? randomFloat(1.6, 3.2) : 1;
  return checkpointSpike * launchSpike * randomSpike;
}

function generateError(route: TelemetryRoute, model: TelemetryModel, volumeFactor: number): string | null {
  const errorRoll = Math.random();
  const baseErrorRate = route === "/api/autocomplete" ? 0.012 : route === "/api/search" ? 0.018 : route === "/api/chat" ? 0.022 : route === "/api/summarize" ? 0.028 : 0.034;
  const adjustedErrorRate = baseErrorRate + Math.max(0, volumeFactor - 1.2) * 0.02;

  if (errorRoll > adjustedErrorRate) {
    return null;
  }

  const rateLimitChance = model === "gpt-4o-mini" || model === "claude-haiku" ? 0.6 : 0.35;
  if (Math.random() < rateLimitChance) {
    return `HTTP_429_RATE_LIMIT:${route}`;
  }

  return `HTTP_500_UPSTREAM_ERROR:${route}`;
}

function jitterTimestamp(timestamp: number): number {
  return timestamp - randomInt(0, 9_000);
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
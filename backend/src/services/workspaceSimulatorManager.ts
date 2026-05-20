import { telemetryBus } from "./telemetryBus";
import { ingestTelemetry } from "./ingestService";
import { getWorkspaceApiKey, regenerateWorkspaceApiKey } from "./authService";
import { getTelemetryCount } from "./telemetryRepository";
import type { IngestTelemetryInput } from "../types/ingest";

const ROUTES = ["/api/chat", "/api/search", "/api/summarize", "/api/autocomplete", "/api/agents"] as const;
const MODELS = ["gpt-4o", "gpt-4o-mini", "claude-sonnet", "claude-haiku"] as const;
const PROVIDERS = ["OpenAI", "Anthropic"] as const;

interface WorkspaceSimulator {
  workspaceId: string;
  interval: NodeJS.Timeout;
  recordsGenerated: number;
  started: number;
}

const activeSimulators = new Map<string, WorkspaceSimulator>();

/**
 * Start a telemetry simulator for a specific workspace
 * Generates realistic traffic that flows through the ingest API
 */
export function startWorkspaceSimulator(workspaceId: string): boolean {
  // Don't start duplicate simulators
  if (activeSimulators.has(workspaceId)) {
    return false;
  }

  try {
    // Get or create API key for this workspace
    if (!getWorkspaceApiKey(workspaceId)) {
      const regeneratedKey = regenerateWorkspaceApiKey(workspaceId);
      if (!regeneratedKey) {
        console.warn(`[workspace-simulator] Failed to create API key for workspace ${workspaceId}`);
        return false;
      }
    }

    // Generate initial batch of records (seeding)
    const initialBatch = generateTelemetryBatch(workspaceId, 3, true);
    ingestTelemetry(workspaceId, initialBatch);
    telemetryBus.emitSeeded(workspaceId, initialBatch.length);

    // Start interval to generate more records every 2-5 seconds
    const interval = setInterval(() => {
      try {
        const batch = generateTelemetryBatch(workspaceId, 1, false);
        if (batch.length > 0) {
          ingestTelemetry(workspaceId, batch);
          const simulator = activeSimulators.get(workspaceId);
          if (simulator) {
            simulator.recordsGenerated += batch.length;
          }
        }
      } catch (error) {
        console.error(`[workspace-simulator:${workspaceId}]`, error);
      }
    }, Math.random() * 3000 + 2000); // 2-5 second random interval
    interval.unref?.();

    activeSimulators.set(workspaceId, {
      workspaceId,
      interval,
      recordsGenerated: initialBatch.length,
      started: Date.now(),
    });

    console.info(`[workspace-simulator] Started simulator for workspace ${workspaceId}, seeded ${initialBatch.length} records`);
    return true;
  } catch (error) {
    console.error(`[workspace-simulator:startup] Failed to start simulator for ${workspaceId}:`, error);
    return false;
  }
}

/**
 * Stop a workspace simulator
 */
export function stopWorkspaceSimulator(workspaceId: string): boolean {
  const simulator = activeSimulators.get(workspaceId);
  if (!simulator) {
    return false;
  }

  try {
    clearInterval(simulator.interval);
    activeSimulators.delete(workspaceId);
    console.info(`[workspace-simulator] Stopped simulator for workspace ${workspaceId} (${simulator.recordsGenerated} records generated)`);
    return true;
  } catch (error) {
    console.error(`[workspace-simulator:stop]`, error);
    return false;
  }
}

/**
 * Get simulator status
 */
export function getWorkspaceSimulatorStatus(workspaceId: string): {
  running: boolean;
  recordsGenerated: number;
  uptime: number;
} | null {
  const simulator = activeSimulators.get(workspaceId);
  if (!simulator) {
    return null;
  }

  return {
    running: true,
    recordsGenerated: simulator.recordsGenerated,
    uptime: Date.now() - simulator.started,
  };
}

/**
 * Stop all active simulators
 */
export function stopAllSimulators(): void {
  for (const [workspaceId, simulator] of activeSimulators) {
    clearInterval(simulator.interval);
    console.info(`[workspace-simulator] Stopped simulator for workspace ${workspaceId}`);
  }
  activeSimulators.clear();
}

/**
 * Get count of active simulators
 */
export function getActiveSimulatorCount(): number {
  return activeSimulators.size;
}

/**
 * Generate a batch of realistic telemetry records
 */
function generateTelemetryBatch(workspaceId: string, count: number, isSeeding: boolean): IngestTelemetryInput[] {
  const records: IngestTelemetryInput[] = [];

  for (let i = 0; i < count; i++) {
    const route = pickRandom(ROUTES);
    const model = pickRandom(MODELS);
    const provider = pickRandom(PROVIDERS);

    // Determine if this is an error (5% chance)
    const isError = Math.random() < 0.05;
    const error = isError ? (Math.random() < 0.7 ? null : "Rate limit exceeded") : null;

    // Generate realistic token counts
    const inputTokens = Math.floor(Math.random() * 1500) + 100; // 100-1600
    const outputTokens = Math.floor(Math.random() * 2000) + 50; // 50-2050
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost based on model
    const costPerInputMillion = provider === "OpenAI" ? 2.5 : 3.0;
    const costPerOutputMillion = provider === "OpenAI" ? 10.0 : 15.0;
    const costUsd = (inputTokens / 1_000_000) * costPerInputMillion + (outputTokens / 1_000_000) * costPerOutputMillion;

    // Generate realistic latency
    const baseLatency = model.includes("mini") ? 800 : model.includes("gpt-4") ? 1200 : 1000;
    const latencyMs = Math.floor(Math.random() * 1000 + baseLatency);

    // For seeding, spread timestamps over the last 24 hours
    const timestamp = isSeeding
      ? Date.now() - Math.floor(Math.random() * 86400000) // Last 24 hours
      : Date.now() - Math.floor(Math.random() * 5000); // Last 5 seconds

    records.push({
      timestamp,
      route: route as string,
      model: model as string,
      provider: provider as string,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      error,
      identity: {
        id: `user_${Math.floor(Math.random() * 100)}`,
        traits: {
          org: "demo",
          tier: "standard",
        },
      },
    });
  }

  return records;
}

function pickRandom<T>(values: readonly T[]): T {
  const value = values[Math.floor(Math.random() * values.length)];
  if (value === undefined) {
    throw new Error("Cannot pick a random value from an empty list");
  }
  return value;
}

import { DEFAULT_ENDPOINT } from "./defaults.js";
import { createIdentifyRecord, createSimulationRecord, createTrackRecord, defaultSimulationIntervalMs } from "./generator.js";
import { getState, readSimulationState, setConfig, setIdentity, setSimulationFlags, setSimulationTimer, snapshot, isInitialized, markInitialized } from "./state.js";
import { configureTransport, flush as flushTransport, getTransportStats, postJson } from "./transport.js";
import { maybeUnref } from "./internal/utils.js";
import type {
  TokenWatchIdentity,
  TokenWatchInitOptions,
  TokenWatchSimulationController,
  TokenWatchSimulationOptions,
  TokenWatchTrackOptions
} from "./types";

export function init(options: TokenWatchInitOptions): ReturnType<typeof snapshot> {
  if (!options.apiKey) {
    throw new Error("TokenWatch.init(): apiKey is required");
  }
  if (!options.workspaceId) {
    throw new Error("TokenWatch.init(): workspaceId is required");
  }
  if (!options.apiUrl) {
    throw new Error("TokenWatch.init(): apiUrl is required");
  }

  if (isInitialized()) {
    console.warn("TokenWatch.init() was called multiple times. Previous configuration will be replaced.");
  }

  const result = setConfig({
    apiUrl: options.apiUrl,
    apiKey: options.apiKey,
    workspaceId: options.workspaceId,
    endpoint: options.endpoint || DEFAULT_ENDPOINT,
    headers: {
      ...(options.headers ?? {}),
      "X-API-Key": options.apiKey
    }
  });

  configureTransport({
    maxQueueSize: options.maxQueueSize,
    batchSize: options.batchSize,
    flushInterval: options.flushInterval,
    retryAttempts: options.retryAttempts,
    debug: options.debug
  });

  markInitialized();
  return result;
}

export function setEndpoint(endpoint: string): ReturnType<typeof snapshot> {
  return setConfig({ endpoint: endpoint || DEFAULT_ENDPOINT });
}

export async function track(name: string, options: TokenWatchTrackOptions = {}): Promise<void> {
  if (!isInitialized()) {
    console.warn("TokenWatch.track() called before TokenWatch.init(). Event will be ignored.");
    return;
  }
  
  const state = getState();
  const record = createTrackRecord(name, state.workspaceId, state.identity, options);
  await postJson(snapshot(), state.endpoint, record as unknown as Record<string, unknown>);
}

export async function identify(id: string, traits?: Record<string, unknown>): Promise<TokenWatchIdentity> {
  const identity = { id, traits };
  
  if (!isInitialized()) {
    console.warn("TokenWatch.identify() called before TokenWatch.init(). Event will be ignored.");
    return identity;
  }

  setIdentity(identity);

  const state = getState();
  const record = createIdentifyRecord(id, state.workspaceId, traits);
  await postJson(snapshot(), state.endpoint, record as unknown as Record<string, unknown>);

  return identity;
}

export async function simulate(options: TokenWatchSimulationOptions = {}): Promise<ReturnType<typeof createSimulationRecord>> {
  if (!isInitialized()) {
    console.warn("TokenWatch.simulate() called before TokenWatch.init(). Event will be ignored.");
    return createSimulationRecord("", null, options);
  }

  const state = getState();
  const record = createSimulationRecord(state.workspaceId, state.identity, options);
  await postJson(snapshot(), state.endpoint, record as unknown as Record<string, unknown>);
  return record;
}

export function startSimulation(options: TokenWatchSimulationOptions = {}): TokenWatchSimulationController {
  if (!isInitialized()) {
    console.warn("TokenWatch.startSimulation() called before TokenWatch.init(). Simulation will not start.");
    return {
      get running() {
        return false;
      },
      stop: () => {
        // no-op
      }
    };
  }

  stopSimulation();

  const intervalMs = defaultSimulationIntervalMs(options.intervalMs, options.profile);
  setSimulationFlags(true, false);

  const controller: TokenWatchSimulationController = {
    get running() {
      return readSimulationState().running;
    },
    stop: () => stopSimulation()
  };

  const loop = async (): Promise<void> => {
    const current = readSimulationState();
    if (!current.running || current.stopRequested) {
      return;
    }
    // Backpressure: if queue is very large, slow down or skip simulation iterations
    try {
      const transportStats = getTransportStats();
      const pressureThreshold = Math.max(1, Math.floor(transportStats.maxQueueSize * 0.8));
      if (transportStats.queueSize >= pressureThreshold) {
        if (typeof globalThis !== "undefined" && (globalThis as any).__TOKENWATCH_DEBUG === true) {
          console.warn(`[TokenWatch simulation] high queue pressure (${transportStats.queueSize}), backing off`);
        }
        const backoffMs = Math.min(1000, intervalMs * 2);
        const timer = setTimeout(() => {
          void loop();
        }, backoffMs);
        maybeUnref(timer);
        setSimulationTimer(timer);
        return;
      }
    } catch (e) {
      // ignore queue errors and continue
    }
    try {
      await simulate(options);
    } catch (error) {
      console.warn("TokenWatch simulation error:", error instanceof Error ? error.message : String(error));
    }

    const after = readSimulationState();
    if (!after.running || after.stopRequested) {
      return;
    }

    const timer = setTimeout(() => {
      void loop();
    }, intervalMs);
    maybeUnref(timer);
    setSimulationTimer(timer);
  };

  const timer = setTimeout(() => {
    void loop();
  }, 0);
  maybeUnref(timer);
  setSimulationTimer(timer);

  return controller;
}

export async function flush(): Promise<void> {
  await flushTransport();
}

export function stats(): ReturnType<typeof getTransportStats> {
  return getTransportStats();
}

export function stopSimulation(): void {
  const current = readSimulationState();
  if (current.timer) {
    clearTimeout(current.timer);
  }

  setSimulationTimer(null);
  setSimulationFlags(false, true);
}

// maybeUnref moved to internal/utils.ts

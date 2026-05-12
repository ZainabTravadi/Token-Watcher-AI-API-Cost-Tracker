import { DEFAULT_API_URL, DEFAULT_ENDPOINT, DEFAULT_PROJECT_ID } from "./defaults.js";
import { createIdentifyRecord, createSimulationRecord, createTrackRecord, defaultSimulationIntervalMs } from "./generator.js";
import { getState, readSimulationState, setConfig, setIdentity, setSimulationFlags, setSimulationTimer, snapshot } from "./state.js";
import { postJson } from "./transport.js";
import type {
  TokenWatchIdentity,
  TokenWatchInitOptions,
  TokenWatchSimulationController,
  TokenWatchSimulationOptions,
  TokenWatchTrackOptions
} from "./types";

export function init(options: TokenWatchInitOptions): ReturnType<typeof snapshot> {
  return setConfig({
    apiUrl: options.apiUrl || DEFAULT_API_URL,
    endpoint: options.endpoint || DEFAULT_ENDPOINT,
    projectId: options.projectId || DEFAULT_PROJECT_ID,
    headers: options.headers ?? {}
  });
}

export function setEndpoint(endpoint: string): ReturnType<typeof snapshot> {
  return setConfig({ endpoint: endpoint || DEFAULT_ENDPOINT });
}

export async function track(name: string, options: TokenWatchTrackOptions = {}): Promise<void> {
  const state = getState();
  const record = createTrackRecord(name, state.projectId, state.identity, options);
  await postJson(snapshot(), state.endpoint, record as unknown as Record<string, unknown>);
}

export async function identify(id: string, traits?: Record<string, unknown>): Promise<TokenWatchIdentity> {
  const identity = { id, traits };
  setIdentity(identity);

  const state = getState();
  const record = createIdentifyRecord(id, state.projectId, traits);
  await postJson(snapshot(), state.endpoint, record as unknown as Record<string, unknown>);

  return identity;
}

export async function simulate(options: TokenWatchSimulationOptions = {}): Promise<ReturnType<typeof createSimulationRecord>> {
  const state = getState();
  const record = createSimulationRecord(state.projectId, state.identity, options);
  await postJson(snapshot(), state.endpoint, record as unknown as Record<string, unknown>);
  return record;
}

export function startSimulation(options: TokenWatchSimulationOptions = {}): TokenWatchSimulationController {
  stopSimulation();

  const intervalMs = defaultSimulationIntervalMs(options.intervalMs);
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

    try {
      await simulate(options);
    } finally {
      const after = readSimulationState();
      if (!after.running || after.stopRequested) {
        return;
      }

      const timer = setTimeout(() => {
        void loop();
      }, intervalMs);
      maybeUnref(timer);
      setSimulationTimer(timer);
    }
  };

  const timer = setTimeout(() => {
    void loop();
  }, 0);
  maybeUnref(timer);
  setSimulationTimer(timer);

  return controller;
}

export function stopSimulation(): void {
  const current = readSimulationState();
  if (current.timer) {
    clearTimeout(current.timer);
  }

  setSimulationTimer(null);
  setSimulationFlags(false, true);
}

function maybeUnref(timer: ReturnType<typeof setTimeout>): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref?: () => void }).unref?.();
  }
}
import { DEFAULT_API_URL, DEFAULT_ENDPOINT, DEFAULT_PROJECT_ID } from "./defaults.js";
import type { TokenWatchIdentity, TokenWatchStateSnapshot } from "./types.js";

interface InternalState extends TokenWatchStateSnapshot {
  simulationTimer: ReturnType<typeof setTimeout> | null;
  simulationRunning: boolean;
  simulationStopRequested: boolean;
}

const state: InternalState = {
  apiUrl: DEFAULT_API_URL,
  endpoint: DEFAULT_ENDPOINT,
  projectId: DEFAULT_PROJECT_ID,
  headers: {},
  identity: null,
  simulationTimer: null,
  simulationRunning: false,
  simulationStopRequested: false
};

export function getState(): InternalState {
  return state;
}

export function setConfig(partial: Partial<TokenWatchStateSnapshot>): TokenWatchStateSnapshot {
  if (partial.apiUrl) {
    state.apiUrl = partial.apiUrl;
  }

  if (partial.endpoint) {
    state.endpoint = partial.endpoint;
  }

  if (partial.projectId) {
    state.projectId = partial.projectId;
  }

  if (partial.headers) {
    state.headers = { ...state.headers, ...partial.headers };
  }

  if (partial.identity !== undefined) {
    state.identity = partial.identity;
  }

  return snapshot();
}

export function setIdentity(identity: TokenWatchIdentity | null): TokenWatchStateSnapshot {
  state.identity = identity;
  return snapshot();
}

export function setSimulationTimer(timer: ReturnType<typeof setTimeout> | null): void {
  state.simulationTimer = timer;
}

export function setSimulationFlags(running: boolean, stopRequested: boolean): void {
  state.simulationRunning = running;
  state.simulationStopRequested = stopRequested;
}

export function snapshot(): TokenWatchStateSnapshot {
  return {
    apiUrl: state.apiUrl,
    endpoint: state.endpoint,
    projectId: state.projectId,
    headers: { ...state.headers },
    identity: state.identity ? { ...state.identity, traits: state.identity.traits ? { ...state.identity.traits } : undefined } : null
  };
}

export function readSimulationState(): { running: boolean; stopRequested: boolean; timer: ReturnType<typeof setTimeout> | null } {
  return {
    running: state.simulationRunning,
    stopRequested: state.simulationStopRequested,
    timer: state.simulationTimer
  };
}
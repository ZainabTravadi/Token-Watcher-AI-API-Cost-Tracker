export type {
  TokenWatchIdentity,
  TokenWatchInitOptions,
  TokenWatchProvider,
  TokenWatchSimulationController,
  TokenWatchSimulationOptions,
  TokenWatchStateSnapshot,
  TokenWatchTelemetryRecord,
  TokenWatchTrackInput,
  TokenWatchTrackOptions
} from "./types.js";

export { identify, init, setEndpoint, simulate, startSimulation, stopSimulation, track } from "./client.js";
export { TokenWatch } from "./namespace.js";
export { default } from "./namespace.js";
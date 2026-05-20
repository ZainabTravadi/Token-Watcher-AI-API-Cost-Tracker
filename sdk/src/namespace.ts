import { flush, identify, init, setEndpoint, simulate, startSimulation, stats, stopSimulation, track } from "./client.js";

export const TokenWatch = {
  init,
  setEndpoint,
  flush,
  stats,
  track,
  identify,
  simulate,
  startSimulation,
  stopSimulation
} as const;

export default TokenWatch;

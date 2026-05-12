import { identify, init, setEndpoint, simulate, startSimulation, stopSimulation, track } from "./client.js";

export const TokenWatch = {
  init,
  setEndpoint,
  track,
  identify,
  simulate,
  startSimulation,
  stopSimulation
} as const;

export default TokenWatch;
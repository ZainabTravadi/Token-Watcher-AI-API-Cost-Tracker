import { telemetryBus } from "./telemetryBus";
import { generateHistoricalDataset } from "./telemetryGenerator";
import {
  hasTelemetryRows,
  insertTelemetry,
  insertTelemetryBatch,
  getTelemetryCount
} from "./telemetryRepository";

export interface SimulatorState {
  running: boolean;
  seededRows: number;
  totalRows: number;
}

export function seedTelemetryDataset(force = false): number {
  if (!force && hasTelemetryRows()) {
    return 0;
  }

  const records = generateHistoricalDataset(7);
  const inserted = insertTelemetryBatch(records);
  telemetryBus.emitSeeded(inserted.length);
  return inserted.length;
}

export function startTelemetrySimulator(): SimulatorState {
  const seededRows = seedTelemetryDataset(false);

  return {
    running: false,
    seededRows,
    totalRows: getTelemetryCount()
  };
}

export function stopTelemetrySimulator(): void {
}

export function getSimulatorStatus(): SimulatorState {
  return {
    running: false,
    seededRows: 0,
    totalRows: getTelemetryCount()
  };
}
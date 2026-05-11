import { telemetryBus } from "./telemetryBus";
import { generateHistoricalDataset, generateTelemetryBatch, estimateBurstSize } from "./telemetryGenerator";
import {
  hasTelemetryRows,
  insertTelemetry,
  insertTelemetryBatch,
  getTelemetryCount
} from "./telemetryRepository";
import type { TelemetryRecord } from "../types/telemetry";

let simulatorTimer: NodeJS.Timeout | null = null;
let realtimeWarmupTimer: NodeJS.Timeout | null = null;

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

  if (simulatorTimer) {
    return {
      running: true,
      seededRows,
      totalRows: getTelemetryCount()
    };
  }

  const tick = () => {
    const now = Date.now();
    const burstSize = estimateBurstSize(new Date(now));
    const batch = generateTelemetryBatch(now, burstSize);
    const inserted = insertTelemetryBatch(batch);

    for (const row of inserted) {
      telemetryBus.emitTelemetry(row as TelemetryRecord);
    }
  };

  tick();

  simulatorTimer = setInterval(tick, 4_000);
  simulatorTimer.unref?.();

  realtimeWarmupTimer = setInterval(() => {
    const now = Date.now();
    const warmupBatch = generateTelemetryBatch(now, 1);
    const [row] = insertTelemetryBatch(warmupBatch);
    if (row) {
      telemetryBus.emitTelemetry(row as TelemetryRecord);
    }
  }, 15_000);
  realtimeWarmupTimer.unref?.();

  return {
    running: true,
    seededRows,
    totalRows: getTelemetryCount()
  };
}

export function stopTelemetrySimulator(): void {
  if (simulatorTimer) {
    clearInterval(simulatorTimer);
    simulatorTimer = null;
  }

  if (realtimeWarmupTimer) {
    clearInterval(realtimeWarmupTimer);
    realtimeWarmupTimer = null;
  }
}

export function getSimulatorStatus(): SimulatorState {
  return {
    running: simulatorTimer !== null,
    seededRows: 0,
    totalRows: getTelemetryCount()
  };
}
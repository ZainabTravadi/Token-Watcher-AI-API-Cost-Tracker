import { EventEmitter } from "node:events";
import type { TelemetryRecord } from "../types/telemetry";

export type TelemetryBusEvents = {
  telemetry: (record: TelemetryRecord) => void;
  seeded: (count: number) => void;
};

class TelemetryBus extends EventEmitter {
  emitTelemetry(record: TelemetryRecord): void {
    this.emit("telemetry", record);
  }

  emitSeeded(count: number): void {
    this.emit("seeded", count);
  }
}

export const telemetryBus = new TelemetryBus();
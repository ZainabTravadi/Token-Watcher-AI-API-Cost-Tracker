import type { Request, Response } from "express";
import { telemetryBus } from "./telemetryBus";
import type { TelemetryRecord } from "../types/telemetry";

const heartbeatMs = 15_000;

export function setupWorkspaceSse(request: Request, response: Response, workspaceId: string): void {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();

  let closed = false;
  // Track active SSE connections for operational visibility
  incrementActiveSseConnections();
  const send = (event: string, payload: unknown): void => {
    if (closed || response.destroyed) {
      return;
    }
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const telemetryHandler = (record: TelemetryRecord): void => {
    if (record.workspace_id === workspaceId) {
      send("telemetry", record);
    }
  };

  const seededHandler = (event: { workspaceId: string; count: number }): void => {
    if (event.workspaceId === workspaceId) {
      send("seeded", { count: event.count });
    }
  };

  telemetryBus.on("telemetry", telemetryHandler);
  telemetryBus.on("seeded", seededHandler);

  send("connected", { ok: true, workspaceId });

  const keepAlive = setInterval(() => {
    send("ping", { ts: Date.now() });
  }, heartbeatMs);
  keepAlive.unref?.();

  const cleanup = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(keepAlive);
    telemetryBus.off("telemetry", telemetryHandler);
    telemetryBus.off("seeded", seededHandler);
    response.end();
    decrementActiveSseConnections();
  };

  request.on("close", cleanup);
  request.on("aborted", cleanup);
  response.on("error", cleanup);
}

let _activeSseConnections = 0;
function incrementActiveSseConnections(): void {
  _activeSseConnections += 1;
}
function decrementActiveSseConnections(): void {
  _activeSseConnections = Math.max(0, _activeSseConnections - 1);
}

export function getActiveSseConnections(): number {
  return _activeSseConnections;
}

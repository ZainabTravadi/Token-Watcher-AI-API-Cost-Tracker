import { getAnalyticsSnapshot } from "./telemetryRepository";

export function buildAnalyticsSnapshot(workspaceId: string): ReturnType<typeof getAnalyticsSnapshot> {
  return getAnalyticsSnapshot(workspaceId, 72);
}

export function buildRealtimeAnalyticsSnapshot(workspaceId: string): ReturnType<typeof getAnalyticsSnapshot> {
  return getAnalyticsSnapshot(workspaceId, 24);
}
import { getAnalyticsSnapshot } from "./telemetryRepository";
import { getCachedAnalytics, setCachedAnalytics } from "./analyticsCache";

export function buildAnalyticsSnapshot(workspaceId: string): ReturnType<typeof getAnalyticsSnapshot> {
  return getOrBuildSnapshot(workspaceId, 72);
}

export function buildRealtimeAnalyticsSnapshot(workspaceId: string): ReturnType<typeof getAnalyticsSnapshot> {
  return getOrBuildSnapshot(workspaceId, 24);
}

function getOrBuildSnapshot(workspaceId: string, hours: number): ReturnType<typeof getAnalyticsSnapshot> {
  return getCachedAnalytics(workspaceId, hours) ?? setCachedAnalytics(workspaceId, hours, getAnalyticsSnapshot(workspaceId, hours));
}

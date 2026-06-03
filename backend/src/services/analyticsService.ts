import { getAnalyticsSnapshot } from "./telemetryRepository";
import { getCachedAnalytics, setCachedAnalytics } from "./analyticsCache";

export async function buildAnalyticsSnapshot(workspaceId: string): Promise<Awaited<ReturnType<typeof getAnalyticsSnapshot>>> {
  return await getOrBuildSnapshot(workspaceId, 72);
}

export async function buildRealtimeAnalyticsSnapshot(workspaceId: string): Promise<Awaited<ReturnType<typeof getAnalyticsSnapshot>>> {
  return await getOrBuildSnapshot(workspaceId, 24);
}

async function getOrBuildSnapshot(workspaceId: string, hours: number): Promise<Awaited<ReturnType<typeof getAnalyticsSnapshot>>> {
  const cached = getCachedAnalytics(workspaceId, hours);
  if (cached) {
    return cached;
  }
  return setCachedAnalytics(workspaceId, hours, await getAnalyticsSnapshot(workspaceId, hours));
}

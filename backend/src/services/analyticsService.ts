import { getAnalyticsSnapshot } from "./telemetryRepository";

export function buildAnalyticsSnapshot(): ReturnType<typeof getAnalyticsSnapshot> {
  return getAnalyticsSnapshot(72);
}

export function buildRealtimeAnalyticsSnapshot(): ReturnType<typeof getAnalyticsSnapshot> {
  return getAnalyticsSnapshot(24);
}
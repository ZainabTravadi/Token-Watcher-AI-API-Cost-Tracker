import type { AnalyticsSnapshot } from "../types/telemetry";

interface CacheEntry {
  value: AnalyticsSnapshot;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const defaultTtlMs = 2_000;

export function getCachedAnalytics(workspaceId: string, hours: number): AnalyticsSnapshot | null {
  const entry = cache.get(cacheKey(workspaceId, hours));
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.value;
}

export function setCachedAnalytics(workspaceId: string, hours: number, value: AnalyticsSnapshot, ttlMs = defaultTtlMs): AnalyticsSnapshot {
  cache.set(cacheKey(workspaceId, hours), {
    value,
    expiresAt: Date.now() + ttlMs
  });
  return value;
}

export function invalidateAnalyticsCache(workspaceId?: string): void {
  if (!workspaceId) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) {
      cache.delete(key);
    }
  }
}

function cacheKey(workspaceId: string, hours: number): string {
  return `${workspaceId}:${hours}`;
}

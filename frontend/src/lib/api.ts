import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_TOKENWATCH_API_URL ?? "http://localhost:3001";

export { API_BASE_URL };

export type TelemetryProvider = "OpenAI" | "Anthropic";
export type TelemetryModel = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet" | "claude-haiku";
export type TelemetryRoute = "/api/chat" | "/api/summarize" | "/api/search" | "/api/autocomplete" | "/api/agents";

export type EnvironmentType = "development" | "staging" | "production";
export type ReleaseChannel = "stable" | "beta" | "nightly";
export type StreamStatusType = "connecting" | "live" | "reconnecting" | "offline";

export interface VersionInfo {
  full: string;
  releaseChannel: ReleaseChannel;
  buildTime: string;
}

export interface EnvironmentInfo {
  name: EnvironmentType;
  nodeEnv: string;
  port: number;
}

export interface DatabaseStatus {
  status: "connected" | "reconnecting" | "offline" | "degraded";
  responseTime: number;
  lastChecked: string;
}

export interface SimulatorStatus {
  status: "starting" | "warming up" | "live" | "paused" | "offline";
  startTime: string;
  seededRows: number;
  totalRows: number;
}

export interface TelemetryStatus {
  totalRows: number;
  status: "active" | "idle";
}

export interface StreamStatus {
  status: StreamStatusType;
  reconnectAttempts: number;
  lastHeartbeat: string;
}

export interface HealthResponse {
  status: "ok";
  version: VersionInfo;
  environment: EnvironmentInfo;
  database: DatabaseStatus;
  simulator: SimulatorStatus;
  telemetry: TelemetryStatus;
  stream: StreamStatus;
  timestamp: string;
}

export interface SimulatorStatusResponse {
  running: boolean;
  seededRows: number;
  totalRows: number;
}

export interface AnalyticsOverview {
  spendToday: number;
  requestsToday: number;
  avgCostPerRequest: number;
  budget: number;
  errorRate: number;
  errors429: number;
  errors500: number;
}

export interface AnalyticsEndpointRow {
  route: TelemetryRoute;
  requests: number;
  cost_usd: number;
  avg_cost_usd: number;
  avg_latency_ms: number;
}

export interface AnalyticsModelRow {
  model: TelemetryModel;
  provider: TelemetryProvider;
  requests: number;
  tokens: number;
  cost_usd: number;
  avg_latency_ms: number;
}

export interface AnalyticsRecentRow {
  ts: string;
  endpoint: TelemetryRoute;
  model: TelemetryModel;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: "200" | "429" | "500";
}

export interface AnalyticsSnapshot {
  overview: AnalyticsOverview;
  endpoints: AnalyticsEndpointRow[];
  models: AnalyticsModelRow[];
  recent: AnalyticsRecentRow[];
  timeline: Array<{ bucket: string; requests: number; cost_usd: number; latency_ms: number }>;
}

export interface TelemetryRow {
  id: number;
  timestamp: number;
  route: TelemetryRoute;
  model: TelemetryModel;
  provider: TelemetryProvider;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  error: string | null;
}

export type TelemetryStreamStatus = StreamStatusType;

const streamListeners = new Set<() => void>();
let streamStatus: TelemetryStreamStatus = "connecting";

function setStreamStatus(status: TelemetryStreamStatus): void {
  if (status === streamStatus) {
    return;
  }

  streamStatus = status;
  for (const listener of streamListeners) {
    listener();
  }
}

function subscribeStreamStatus(listener: () => void): () => void {
  streamListeners.add(listener);
  return () => {
    streamListeners.delete(listener);
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    credentials: "include",
    ...init
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

/**
 * Extract JWT token from cookies
 * EventSource doesn't support custom headers, so we need to pass the token as a query parameter
 */
export function getJwtToken(): string | null {
  const name = "tokenwatch_auth";
  const nameEQ = name + "=";
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(nameEQ)) {
      return cookie.substring(nameEQ.length);
    }
  }
  return null;
}

export async function fetchSimulatorStatus(): Promise<SimulatorStatusResponse> {
  const response = await apiFetch<{ data: SimulatorStatusResponse }>("/api/telemetry/status");
  return response.data;
}

export async function fetchAnalyticsSnapshot(workspaceId?: string): Promise<AnalyticsSnapshot> {
  const url = workspaceId ? `/api/analytics/snapshot?workspaceId=${workspaceId}` : "/api/analytics/snapshot";
  const response = await apiFetch<{ data: AnalyticsSnapshot }>(url);
  return response.data;
}

export async function fetchTelemetryRows(workspaceId?: string, limit = 500): Promise<TelemetryRow[]> {
  const url = workspaceId 
    ? `/api/telemetry?workspaceId=${workspaceId}&limit=${limit}`
    : `/api/telemetry?limit=${limit}`;
  const response = await apiFetch<{ data: TelemetryRow[] }>(url);
  return response.data;
}

export function useHealthQuery() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 1
  });
}

export function useSimulatorStatusQuery() {
  return useQuery({
    queryKey: ["simulator-status"],
    queryFn: fetchSimulatorStatus,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 1
  });
}

export function useAnalyticsSnapshotQuery(workspaceId?: string) {
  return useQuery({
    queryKey: ["analytics-snapshot", workspaceId],
    queryFn: () => fetchAnalyticsSnapshot(workspaceId),
    refetchInterval: 5_000,
    staleTime: 2_000,
    retry: 1,
    enabled: !!workspaceId
  });
}

export function useTelemetryRowsQuery(workspaceId?: string, limit = 500) {
  return useQuery({
    queryKey: ["telemetry-rows", workspaceId, limit],
    queryFn: () => fetchTelemetryRows(workspaceId, limit),
    refetchInterval: 4_000,
    staleTime: 1_000,
    retry: 1,
    enabled: !!workspaceId
  });
}

export function useTelemetryLiveRefresh(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    setStreamStatus("connecting");
    const source = new EventSource(`${API_BASE_URL}/api/telemetry/stream`, {
      withCredentials: true
    });

    source.onopen = () => {
      setStreamStatus("live");
    };

    const refresh = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["telemetry-rows"] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["simulator-status"] });
    };

    source.addEventListener("telemetry", refresh);
    source.addEventListener("seeded", refresh);
    source.addEventListener("connected", refresh);
    source.onerror = () => {
      setStreamStatus(source.readyState === EventSource.CLOSED ? "offline" : "reconnecting");
    };

    return () => {
      setStreamStatus("offline");
      source.close();
    };
  }, [queryClient]);
}

export function useTelemetryStreamStatus(): TelemetryStreamStatus {
  return useSyncExternalStore(subscribeStreamStatus, () => streamStatus, () => "connecting");
}

export function useDashboardHealthLabel(): string {
  const { data, isLoading, isError } = useHealthQuery();

  return useMemo(() => {
    if (isLoading) {
      return "connecting";
    }

    if (isError || !data) {
      return "offline";
    }

    return `live · ${formatTelemetryCount(data.telemetry.totalRows)}`;
  }, [data, isError, isLoading]);
}

export function formatTelemetryCount(count: number): string {
  if (count === 0) return "0";
  if (count < 1000) return count.toString();
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export function apiBaseUrl(): string {
  return API_BASE_URL;
}
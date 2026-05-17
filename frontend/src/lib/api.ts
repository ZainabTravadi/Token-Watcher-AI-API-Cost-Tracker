import { useMemo, useSyncExternalStore } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_TOKENWATCH_API_URL ?? "http://localhost:3001";

export { API_BASE_URL };

export type TelemetryProvider = "OpenAI" | "Anthropic" | "Google";
export type TelemetryModel = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet" | "claude-haiku";
export type TelemetryRoute = "/api/chat" | "/api/summarize" | "/api/search" | "/api/autocomplete" | "/api/agents";

export type EnvironmentType = "development" | "staging" | "production";
export type ReleaseChannel = "stable" | "beta" | "nightly";
export type StreamStatusType = "connecting" | "live" | "reconnecting" | "offline" | "unauthorized";

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
  errorsNetwork?: number;
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
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  avg_latency_ms: number;
}

export interface AnalyticsRecentRow {
  ts: string;
  endpoint: TelemetryRoute;
  model: TelemetryModel;
  provider: TelemetryProvider;
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
  workspace_id: string;
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

export interface RequestLogQuery {
  page?: number;
  limit?: number;
  route?: TelemetryRoute | "all";
  model?: TelemetryModel[];
  cursor?: string;
}

export interface RequestLogResponse {
  data: TelemetryRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export type TelemetryStreamStatus = StreamStatusType;

const streamListeners = new Set<() => void>();
let streamStatus: TelemetryStreamStatus = "connecting";
let requestLogRefreshEnabled = true;

export function setRequestLogRefreshEnabled(enabled: boolean): void {
  requestLogRefreshEnabled = enabled;
}

export function isRequestLogRefreshEnabled(): boolean {
  return requestLogRefreshEnabled;
}

function setStreamStatus(status: TelemetryStreamStatus): void {
  if (status === streamStatus) {
    return;
  }

  streamStatus = status;
  for (const listener of streamListeners) {
    listener();
  }
}

// Exported setter so external owners of the EventSource (eg. StatusContext)
// can update the shared stream status and drive query invalidation logic.
export { setStreamStatus };
function subscribeStreamStatus(listener: () => void): () => void {
  streamListeners.add(listener);
  return () => {
    streamListeners.delete(listener);
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
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
  const preferredNames = ["tokenwatch_stream", "tokenwatch_auth"];
  const cookies = document.cookie.split(";");
  for (const name of preferredNames) {
    const nameEQ = name + "=";
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return cookie.substring(nameEQ.length);
      }
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

export async function fetchRequestLog(workspaceId?: string, query: RequestLogQuery = {}): Promise<RequestLogResponse> {
  const params = new URLSearchParams();

  if (workspaceId) params.set("workspaceId", workspaceId);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.route && query.route !== "all") params.set("route", query.route);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.model && query.model.length > 0) {
    for (const model of query.model) {
      params.append("model", model);
    }
  }

  const response = await apiFetch<{ data: RequestLogResponse }>(`/api/requests?${params.toString()}`);
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
  const streamStatus = useTelemetryStreamStatus();
  return useQuery({
    queryKey: ["analytics-snapshot", workspaceId],
    queryFn: () => fetchAnalyticsSnapshot(workspaceId),
    refetchInterval: streamStatus === "offline" || streamStatus === "unauthorized" ? 5_000 : false,
    staleTime: 2_000,
    retry: 1,
    enabled: !!workspaceId
  });
}

export function useTelemetryRowsQuery(workspaceId?: string, limit = 500) {
  const streamStatus = useTelemetryStreamStatus();
  return useQuery({
    queryKey: ["telemetry-rows", workspaceId, limit],
    queryFn: () => fetchTelemetryRows(workspaceId, limit),
    refetchInterval: streamStatus === "offline" || streamStatus === "unauthorized" ? 4_000 : false,
    staleTime: 1_000,
    retry: 1,
    enabled: !!workspaceId
  });
}

export function useTelemetryLiveRefresh(): void {
  // Deprecated: SSE ownership is managed by StatusContext in the app
  // to avoid duplicate EventSource instances. Keep a no-op hook so
  // existing imports remain valid and tests won't fail.
  return;
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

export function useRequestLogQuery(workspaceId?: string, query: RequestLogQuery = {}) {
  const streamStatus = useTelemetryStreamStatus();
  const modelsKey = (query.model ?? []).slice().sort().join(",");

  return useQuery({
    queryKey: ["request-log", workspaceId, query.page ?? 1, query.limit ?? 50, query.route ?? "all", modelsKey, query.cursor ?? ""],
    queryFn: () => fetchRequestLog(workspaceId, query),
    refetchInterval: streamStatus === "offline" || streamStatus === "unauthorized" ? 5_000 : false,
    staleTime: 1_000,
    retry: 1,
    enabled: !!workspaceId,
    placeholderData: keepPreviousData
  });
}
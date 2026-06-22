import { useMemo, useSyncExternalStore } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

function resolveApiBaseUrl(): string {
  if (import.meta.env.VITE_TOKENWATCH_API_URL) {
    return import.meta.env.VITE_TOKENWATCH_API_URL;
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${hostname}:3001`;
    }
  }

  return "http://localhost:3001";
}

const API_BASE_URL = resolveApiBaseUrl();

export { API_BASE_URL };

export type TelemetryProvider = string;
export type TelemetryModel = string;
export type TelemetryRoute = string;

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
  status: "200" | "429" | "500" | "ERR";
}

export interface TelemetryDimensions {
  models: string[];
  providers: string[];
  routes: string[];
}

export interface AnalyticsSnapshot {
  overview: AnalyticsOverview;
  endpoints: AnalyticsEndpointRow[];
  models: AnalyticsModelRow[];
  recent: AnalyticsRecentRow[];
  timeline: Array<{ bucket: string; requests: number; cost_usd: number; latency_ms: number }>;
  dimensions: TelemetryDimensions;
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
  metadata?: string | null;
}

export interface RequestLogQuery {
  page?: number;
  limit?: number;
  route?: TelemetryRoute | "all";
  model?: TelemetryModel[];
  provider?: TelemetryProvider | "all";
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

export interface WorkspaceSettingsResponse {
  id: string;
  workspace_id: string;
  alert_on_high_cost: boolean;
  alert_on_errors: boolean;
  alert_cost_threshold: number;
  updated_at: number;
}

export type EndpointRow = AnalyticsEndpointRow;
export type ModelRow = AnalyticsModelRow;
export type RequestRow = TelemetryRow;
export type TelemetryEvent = TelemetryRow;

export type TelemetryStreamStatus = StreamStatusType;

const streamListeners = new Set<() => void>();
let streamStatus: TelemetryStreamStatus = "connecting";
let requestLogRefreshEnabled = true;
const authInvalidationListeners = new Set<() => void>();
let hasInvalidated = false;

export function subscribeAuthInvalidation(listener: () => void): () => void {
  authInvalidationListeners.add(listener);
  return () => authInvalidationListeners.delete(listener);
}

export function triggerAuthInvalidation(): void {
  if (hasInvalidated) {
    return;
  }

  hasInvalidated = true;
  for (const listener of authInvalidationListeners) {
    listener();
  }
}

export function resetAuthInvalidation(): void {
  hasInvalidated = false;
}

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

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    },
    credentials: "include"
  });

  const shouldInvalidate =
    !path.startsWith("/api/auth/login") &&
    !path.startsWith("/api/auth/signup");

  if (shouldInvalidate && (response.status === 401 || response.status === 403)) {
    triggerAuthInvalidation();
  }

  return response;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(path, init);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
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
  if (query.provider && query.provider !== "all") params.set("provider", query.provider);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.model && query.model.length > 0) {
    for (const model of query.model) {
      params.append("model", model);
    }
  }

  const response = await apiFetch<{ data: RequestLogResponse }>(`/api/requests?${params.toString()}`);
  return response.data;
}

export async function fetchAiInsights(workspaceId?: string): Promise<{ insights: string[]; summary?: any }> {
  const body = workspaceId ? { workspaceId } : {};
  const response = await apiFetch<{ data: { insights: string[]; summary?: any } }>(`/api/ai/insights`, { method: "POST", body: JSON.stringify(body) });
  return response.data;
}

export function useHealthQuery() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 1
  });
}

export function useAnalyticsSnapshotQuery(workspaceId?: string) {
  const streamStatus = useTelemetryStreamStatus();
  return useQuery<AnalyticsSnapshot>({
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
  return useQuery<TelemetryRow[]>({
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

  return useQuery<RequestLogResponse>({
    queryKey: ["request-log", workspaceId, query.page ?? 1, query.limit ?? 50, query.route ?? "all", query.provider ?? "all", modelsKey, query.cursor ?? ""],
    queryFn: () => fetchRequestLog(workspaceId, query),
    refetchInterval: streamStatus === "offline" || streamStatus === "unauthorized" ? 5_000 : false,
    staleTime: 1_000,
    retry: 1,
    enabled: !!workspaceId,
    placeholderData: keepPreviousData
  });
}

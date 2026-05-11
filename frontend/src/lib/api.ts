import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_TOKENWATCH_API_URL ?? "http://localhost:3001";

export type TelemetryProvider = "OpenAI" | "Anthropic";
export type TelemetryModel = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet" | "claude-haiku";
export type TelemetryRoute = "/api/chat" | "/api/summarize" | "/api/search" | "/api/autocomplete" | "/api/agents";

export interface HealthResponse {
  status: "ok";
  database: string;
  telemetry: string;
  telemetryRows: number;
  environment: string;
  port: number;
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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
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

export async function fetchSimulatorStatus(): Promise<SimulatorStatusResponse> {
  const response = await apiFetch<{ data: SimulatorStatusResponse }>("/api/telemetry/status");
  return response.data;
}

export async function fetchAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const response = await apiFetch<{ data: AnalyticsSnapshot }>("/api/analytics/snapshot");
  return response.data;
}

export async function fetchTelemetryRows(limit = 500): Promise<TelemetryRow[]> {
  const response = await apiFetch<{ data: TelemetryRow[] }>(`/api/telemetry?limit=${limit}`);
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

export function useAnalyticsSnapshotQuery() {
  return useQuery({
    queryKey: ["analytics-snapshot"],
    queryFn: fetchAnalyticsSnapshot,
    refetchInterval: 5_000,
    staleTime: 2_000,
    retry: 1
  });
}

export function useTelemetryRowsQuery(limit = 500) {
  return useQuery({
    queryKey: ["telemetry-rows", limit],
    queryFn: () => fetchTelemetryRows(limit),
    refetchInterval: 4_000,
    staleTime: 1_000,
    retry: 1
  });
}

export function useTelemetryLiveRefresh(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL}/api/telemetry/stream`);

    const refresh = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["telemetry-rows"] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["simulator-status"] });
    };

    source.addEventListener("telemetry", refresh);
    source.addEventListener("seeded", refresh);
    source.addEventListener("connected", refresh);

    return () => {
      source.close();
    };
  }, [queryClient]);
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

    return `live · ${data.telemetryRows.toLocaleString()} rows`;
  }, [data, isError, isLoading]);
}

export function apiBaseUrl(): string {
  return API_BASE_URL;
}
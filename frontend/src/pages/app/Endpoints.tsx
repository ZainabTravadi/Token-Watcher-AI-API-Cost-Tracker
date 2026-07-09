import { Suspense, lazy, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import Drawer from "@/components/Drawer";
import { OperationalSummary, type OperationalSummaryItem } from "@/components/OperationalSummary";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartPanel } from "@/components/overview/ChartPanel";
import { DateRangeFilter } from "@/components/overview/DateRangeFilter";
import { ExportButton, type ExportRow } from "@/components/overview/ExportButton";
import { GlobalFilters, type FilterOptionGroup } from "@/components/overview/GlobalFilters";
import { KpiCard } from "@/components/overview/KpiCard";
import { HealthScorePanel, type HealthScore } from "@/components/analytics/HealthScorePanel";
import { RecommendationPanel, type Recommendation } from "@/components/analytics/RecommendationPanel";
import { fmtCompactNum, fmtLatency, fmtNum, fmtPercent, fmtUSD } from "@/lib/data";
import { formatLocalDateInputValue } from "@/lib/dates";
import { type TelemetryRow, useAnalyticsSnapshotQuery, useTelemetryRowsQuery } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getRowStatus, useOverviewFilters } from "@/hooks/useOverviewFilters";

const EndpointCharts = lazy(() => import("@/components/analytics/EntityCharts").then((module) => ({
  default: function Charts({ data }: { data: TrendPoint[] }) {
    return (
      <>
        <ChartPanel title="Endpoint Cost Trend" meta="filtered range" isEmpty={data.length === 0}>
          <module.CostTrendChart data={data} />
        </ChartPanel>
        <ChartPanel title="Endpoint Request Trend" meta="filtered range" isEmpty={data.length === 0}>
          <module.RequestTrendChart data={data} />
        </ChartPanel>
        <ChartPanel title="Latency Trend" meta="average ms" isEmpty={data.length === 0}>
          <module.LatencyTrendChart data={data} />
        </ChartPanel>
        <ChartPanel title="Error Trend" meta="daily rate" isEmpty={data.length === 0}>
          <module.ErrorRateTrendChart data={data} />
        </ChartPanel>
      </>
    );
  },
})));

type TrendPoint = { label: string; cost_usd: number; requests: number; tokens: number; latency_ms: number; error_rate: number };
type EndpointAggregate = {
  route: string;
  requests: number;
  cost_usd: number;
  avg_cost_usd: number;
  avg_latency_ms: number;
  tokens: number;
  error_rate: number;
};

function buildTrend(rows: TelemetryRow[]): TrendPoint[] {
  const buckets = new Map<string, TrendPoint & { latencyTotal: number; errors: number }>();
  for (const row of rows) {
    const key = formatLocalDateInputValue(new Date(row.timestamp));
    const current = buckets.get(key) ?? {
      label: new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cost_usd: 0,
      requests: 0,
      tokens: 0,
      latency_ms: 0,
      error_rate: 0,
      latencyTotal: 0,
      errors: 0,
    };
    current.cost_usd += row.cost_usd;
    current.requests += 1;
    current.tokens += row.total_tokens;
    current.latencyTotal += row.latency_ms;
    current.errors += row.error ? 1 : 0;
    buckets.set(key, current);
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, point]) => ({
    label: point.label,
    cost_usd: point.cost_usd,
    requests: point.requests,
    tokens: point.tokens,
    latency_ms: point.requests > 0 ? point.latencyTotal / point.requests : 0,
    error_rate: point.requests > 0 ? point.errors / point.requests : 0,
  }));
}

function aggregateEndpoints(rows: TelemetryRow[]): EndpointAggregate[] {
  const grouped = new Map<string, EndpointAggregate & { latencyTotal: number; errors: number }>();
  for (const row of rows) {
    const current = grouped.get(row.route) ?? {
      route: row.route,
      requests: 0,
      cost_usd: 0,
      avg_cost_usd: 0,
      avg_latency_ms: 0,
      tokens: 0,
      error_rate: 0,
      latencyTotal: 0,
      errors: 0,
    };
    current.requests += 1;
    current.cost_usd += row.cost_usd;
    current.tokens += row.total_tokens;
    current.latencyTotal += row.latency_ms;
    current.errors += row.error ? 1 : 0;
    grouped.set(row.route, current);
  }
  return [...grouped.values()].map((row) => ({
    route: row.route,
    requests: row.requests,
    cost_usd: row.cost_usd,
    avg_cost_usd: row.requests > 0 ? row.cost_usd / row.requests : 0,
    avg_latency_ms: row.requests > 0 ? row.latencyTotal / row.requests : 0,
    tokens: row.tokens,
    error_rate: row.requests > 0 ? row.errors / row.requests : 0,
  }));
}

function score(value: number, badAt: number): number {
  return Math.max(0, Math.min(100, 100 - (value / badAt) * 100));
}

function buildRecommendations(rows: TelemetryRow[], endpoints: EndpointAggregate[]): Recommendation[] {
  if (rows.length === 0) return [];
  const totalCost = rows.reduce((sum, row) => sum + row.cost_usd, 0);
  const expensive = [...endpoints].sort((a, b) => b.cost_usd - a.cost_usd)[0];
  const slowest = [...endpoints].sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)[0];
  const noisy = [...endpoints].sort((a, b) => b.error_rate - a.error_rate)[0];
  return [
    expensive && {
      title: `Optimize ${expensive.route}`,
      detail: "This is the most expensive visible endpoint. Review prompt length, retrieval payloads, and model routing.",
      impact: "Cost reduction",
      savingsUsd: totalCost * 0.15,
      efficiencyGain: 0.1,
    },
    slowest && {
      title: `Reduce latency on ${slowest.route}`,
      detail: "Consider streaming, smaller context windows, and async background processing for slower responses.",
      impact: "Latency",
      efficiencyGain: 0.08,
    },
    noisy && noisy.error_rate > 0 && {
      title: `Improve reliability for ${noisy.route}`,
      detail: "Add retries with backoff, provider failover, and clearer timeout handling for error-prone traffic.",
      impact: "Reliability",
      efficiencyGain: 0.07,
    },
    {
      title: "Cache stable endpoint responses",
      detail: "Cache deterministic prompts and repeated endpoint-level context to reduce token spend.",
      impact: "Caching",
      savingsUsd: totalCost * 0.1,
      efficiencyGain: 0.06,
    },
    {
      title: "Prompt optimize high-volume paths",
      detail: "Trim boilerplate and move repeated instructions into reusable compact templates.",
      impact: "Prompt optimization",
      savingsUsd: totalCost * 0.08,
      efficiencyGain: 0.05,
    },
  ].filter(Boolean) as Recommendation[];
}

export default function Endpoints() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { currentWorkspace } = useAuth();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const telemetry = useTelemetryRowsQuery(currentWorkspace?.id);
  const rows = telemetry.data ?? [];
  const { dateRange, filters, filteredRows, setDateRange, setFilter, clearFilters } = useOverviewFilters(rows, currentWorkspace?.id);

  const searchedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filteredRows;
    return filteredRows.filter((row) => row.route.toLowerCase().includes(query) || `${row.route} ${row.model} ${row.provider}`.toLowerCase().includes(query));
  }, [filteredRows, search]);

  const endpoints = useMemo(() => aggregateEndpoints(searchedRows).sort((a, b) => b.cost_usd - a.cost_usd || a.route.localeCompare(b.route)), [searchedRows]);
  const trend = useMemo(() => buildTrend(searchedRows), [searchedRows]);
  const selected = selectedRoute ? endpoints.find((row) => row.route === selectedRoute) ?? null : null;
  const selectedHistory = selected ? searchedRows.filter((row) => row.route === selected.route).sort((a, b) => b.timestamp - a.timestamp) : [];
  const totalCost = searchedRows.reduce((sum, row) => sum + row.cost_usd, 0);
  const avgLatency = searchedRows.length > 0 ? searchedRows.reduce((sum, row) => sum + row.latency_ms, 0) / searchedRows.length : 0;
  const errorRate = searchedRows.length > 0 ? searchedRows.filter((row) => row.error).length / searchedRows.length : 0;
  const successRate = 1 - errorRate;
  const topEndpoint = endpoints[0] ?? null;
  const highestTrafficEndpoint = [...endpoints].sort((a, b) => b.requests - a.requests)[0] ?? null;
  const slowestEndpoint = [...endpoints].sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)[0] ?? null;
  const providerDistribution = new Set(searchedRows.map((row) => row.provider).filter(Boolean)).size;
  const topModels = new Set(searchedRows.map((row) => row.model).filter(Boolean)).size;
  const lastEndpointActivity = searchedRows.length > 0 ? Math.max(...searchedRows.map((row) => row.timestamp)) : null;
  const summaryItems: OperationalSummaryItem[] = [
    { label: "Most expensive", value: topEndpoint?.route ?? "none", detail: topEndpoint ? fmtUSD(topEndpoint.cost_usd) : "no endpoint spend" },
    { label: "Highest traffic", value: highestTrafficEndpoint?.route ?? "none", detail: highestTrafficEndpoint ? `${fmtNum(highestTrafficEndpoint.requests)} requests` : "no traffic" },
    { label: "Slowest", value: slowestEndpoint?.route ?? "none", detail: slowestEndpoint ? fmtLatency(slowestEndpoint.avg_latency_ms) : "no latency data", tone: slowestEndpoint && slowestEndpoint.avg_latency_ms > 2500 ? "warn" : "neutral" },
    { label: "Error rate", value: fmtPercent(errorRate), detail: `${fmtPercent(successRate)} success`, tone: errorRate > 0.05 ? "bad" : errorRate > 0 ? "warn" : "good" },
    { label: "Providers", value: fmtNum(providerDistribution), detail: `${fmtNum(topModels)} models observed` },
    { label: "Last request", value: lastEndpointActivity ? new Date(lastEndpointActivity).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "none", detail: lastEndpointActivity ? new Date(lastEndpointActivity).toLocaleDateString() : "waiting for telemetry" },
  ];
  const recommendations = useMemo(() => buildRecommendations(searchedRows, endpoints), [endpoints, searchedRows]);
  const healthScores: HealthScore[] = [
    { label: "Health Score", value: (score(avgLatency, 4000) + score(errorRate, 0.2)) / 2, detail: "Blends latency and success rate." },
    { label: "Average Latency", value: score(avgLatency, 4000), detail: fmtLatency(avgLatency) },
    { label: "Success Rate", value: successRate * 100, detail: fmtPercent(successRate) },
    { label: "Average Cost", value: score(searchedRows.length ? totalCost / searchedRows.length : 0, 0.08), detail: searchedRows.length ? fmtUSD(totalCost / searchedRows.length) : "$0.00" },
    { label: "Request Volume", value: Math.min(100, searchedRows.length), detail: `${fmtNum(searchedRows.length)} visible requests` },
  ];
  const filterGroups = useMemo<FilterOptionGroup[]>(() => {
    const dimensions = analytics.data?.dimensions;
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [
      { key: "provider", label: "Provider", options: unique([...(dimensions?.providers ?? []), ...rows.map((row) => row.provider)]) },
      { key: "model", label: "Model", options: unique([...(dimensions?.models ?? []), ...rows.map((row) => row.model)]) },
      { key: "endpoint", label: "Endpoint", options: unique([...(dimensions?.routes ?? []), ...rows.map((row) => row.route)]) },
      { key: "workspace", label: "Workspace", options: unique([currentWorkspace?.id ?? "", ...rows.map((row) => row.workspace_id)]) },
      { key: "status", label: "Status", options: ["200", "429", "500", "ERR"] },
    ];
  }, [analytics.data?.dimensions, currentWorkspace?.id, rows]);
  const exportRows: ExportRow[] = searchedRows.map((row) => ({
    timestamp: row.timestamp,
    workspace_id: row.workspace_id,
    provider: row.provider,
    model: row.model,
    endpoint: row.route,
    status: getRowStatus(row),
    requests: 1,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    total_tokens: row.total_tokens,
    cost_usd: row.cost_usd,
    latency_ms: row.latency_ms,
  }));

  if (analytics.isLoading || telemetry.isLoading) {
    return (
      <AppLayout title="Endpoints" meta="loading analytics...">
        <PageLoadingState rows={5} />
      </AppLayout>
    );
  }

  if (analytics.isError || telemetry.isError || !analytics.data) {
    return (
      <AppLayout title="Endpoints" meta="backend unavailable">
        <PageErrorState title="Could not load endpoints" message="The analytics API is unavailable. Start the backend and reload the dashboard." />
      </AppLayout>
    );
  }

  return (
    <>
      <AppLayout title="Endpoints" meta={`${endpoints.length} endpoints tracked`}>
        <div className="sticky top-0 z-20 -mx-4 mb-8 border-y border-hairline bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search endpoint, path, or description" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none sm:max-w-sm" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
              <GlobalFilters groups={filterGroups} values={filters} onChange={setFilter} onClear={clearFilters} />
              <ExportButton 
                rows={exportRows} 
                disabled={searchedRows.length === 0}
                workspaceId={currentWorkspace?.id}
                dateRange={dateRange}
                filters={filters}
              />
            </div>
          </div>
        </div>

        <OperationalSummary items={summaryItems} />

        <div className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Requests" value={fmtNum(searchedRows.length)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => point.requests)} tooltip="Visible endpoint request volume." isEmpty={searchedRows.length === 0} />
          <KpiCard title="Total Cost" value={fmtUSD(totalCost)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => point.cost_usd)} tooltip="Visible endpoint spend." isEmpty={searchedRows.length === 0} />
          <KpiCard title="Avg Latency" value={fmtLatency(avgLatency)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => point.latency_ms)} tooltip="Average endpoint latency." isEmpty={searchedRows.length === 0} />
          <KpiCard title="Success Rate" value={fmtPercent(successRate)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => 1 - point.error_rate)} tooltip="Share of visible endpoint requests without errors." isEmpty={searchedRows.length === 0} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-10 xl:grid-cols-2">
          <Suspense fallback={Array.from({ length: 4 }).map((_, index) => <ChartPanel key={index} title="Loading chart" isLoading><Skeleton className="h-[260px]" /></ChartPanel>)}>
            <EndpointCharts data={trend} />
          </Suspense>
        </div>

        <div className="mt-12">
          <HealthScorePanel title="Endpoint Health" scores={healthScores} />
        </div>

        <div className="mt-12">
          <RecommendationPanel title="Endpoint Recommendations" recommendations={recommendations} isEmpty={searchedRows.length === 0} />
        </div>

        <section className="mt-12">
          {endpoints.length === 0 ? (
            <div className="border-t border-hairline py-8 text-center text-sm text-muted-foreground">No endpoint telemetry matches the active filters.</div>
          ) : (
            <DataTable
              columns={[
                { key: "route", label: "Endpoint", render: (row) => <span className="font-mono">{row.route}</span> },
                { key: "requests", label: "Requests", align: "right", render: (row) => fmtNum(row.requests) },
                { key: "cost_usd", label: "Total cost", align: "right", render: (row) => fmtUSD(row.cost_usd) },
                { key: "avg_cost_usd", label: "Avg / req", align: "right", render: (row) => <span className="text-muted-foreground">{fmtUSD(row.avg_cost_usd)}</span> },
                { key: "avg_latency_ms", label: "Avg latency", align: "right", render: (row) => fmtLatency(row.avg_latency_ms) },
                { key: "error_rate", label: "Error rate", align: "right", render: (row) => fmtPercent(row.error_rate) },
              ]}
              rows={endpoints}
              summaryRows={[{
                route: "Endpoint total",
                requests: endpoints.reduce((sum, row) => sum + row.requests, 0),
                cost_usd: endpoints.reduce((sum, row) => sum + row.cost_usd, 0),
                avg_cost_usd: endpoints.reduce((sum, row) => sum + row.cost_usd, 0) / Math.max(1, endpoints.reduce((sum, row) => sum + row.requests, 0)),
                avg_latency_ms: endpoints.reduce((sum, row) => sum + row.avg_latency_ms * row.requests, 0) / Math.max(1, endpoints.reduce((sum, row) => sum + row.requests, 0)),
                tokens: endpoints.reduce((sum, row) => sum + row.tokens, 0),
                error_rate: endpoints.reduce((sum, row) => sum + row.error_rate * row.requests, 0) / Math.max(1, endpoints.reduce((sum, row) => sum + row.requests, 0)),
              }]}
              onRowClick={(row) => setSelectedRoute(row.route)}
              getRowKey={(row) => row.route}
            />
          )}
        </section>
      </AppLayout>

      <Drawer open={Boolean(selected)} onClose={() => setSelectedRoute(null)} title={selected?.route}>
        {selected && (
          <div className="space-y-8">
            <HealthScorePanel title="Selected Endpoint Health" scores={[
              { label: "Health", value: (score(selected.avg_latency_ms, 4000) + score(selected.error_rate, 0.2)) / 2, detail: "Composite score." },
              { label: "Latency", value: score(selected.avg_latency_ms, 4000), detail: fmtLatency(selected.avg_latency_ms) },
              { label: "Success", value: (1 - selected.error_rate) * 100, detail: fmtPercent(1 - selected.error_rate) },
              { label: "Cost", value: score(selected.avg_cost_usd, 0.08), detail: fmtUSD(selected.avg_cost_usd) },
              { label: "Volume", value: Math.min(100, selected.requests), detail: `${fmtNum(selected.requests)} requests` },
            ]} />
            <section>
              <h3 className="label-mono mb-2">Model usage</h3>
              <DataTable
                columns={[
                  { key: "model", label: "Model", render: (row) => <span className="font-mono">{row.model}</span> },
                  { key: "provider", label: "Provider", render: (row) => <span className="font-mono text-muted-foreground">{row.provider}</span> },
                  { key: "requests", label: "Requests", align: "right", render: (row) => fmtNum(row.requests) },
                  { key: "tokens", label: "Tokens", align: "right", render: (row) => fmtCompactNum(row.tokens) },
                  { key: "cost", label: "Cost", align: "right", render: (row) => fmtUSD(row.cost) },
                ]}
                rows={Object.values(selectedHistory.reduce<Record<string, { key: string; model: string; provider: string; requests: number; tokens: number; cost: number }>>((acc, row) => {
                  const key = `${row.model}::${row.provider}`;
                  acc[key] ??= { key, model: row.model, provider: row.provider, requests: 0, tokens: 0, cost: 0 };
                  acc[key].requests += 1;
                  acc[key].tokens += row.total_tokens;
                  acc[key].cost += row.cost_usd;
                  return acc;
                }, {})).sort((a, b) => b.cost - a.cost)}
                getRowKey={(row) => row.key}
              />
            </section>
            <section>
              <h3 className="label-mono mb-2">Request history</h3>
              <DataTable
                columns={[
                  { key: "timestamp", label: "Timestamp", render: (row) => <span className="font-mono text-xs">{new Date(row.timestamp).toLocaleString()}</span> },
                  { key: "model", label: "Model", render: (row) => <span className="font-mono">{row.model}</span> },
                  { key: "input_tokens", label: "In", align: "right", render: (row) => fmtNum(row.input_tokens) },
                  { key: "output_tokens", label: "Out", align: "right", render: (row) => fmtNum(row.output_tokens) },
                  { key: "cost_usd", label: "Cost", align: "right", render: (row) => fmtUSD(row.cost_usd) },
                  { key: "error", label: "Status", align: "right", render: (row) => <span className={`font-mono text-xs ${row.error ? "text-negative" : ""}`}>{getRowStatus(row)}</span> },
                ]}
                rows={selectedHistory.slice(0, 50)}
                getRowKey={(row) => String(row.id)}
              />
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}

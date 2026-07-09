import { Suspense, lazy, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Drawer from "@/components/Drawer";
import { DataTable } from "@/components/DataTable";
import { OperationalSummary, type OperationalSummaryItem } from "@/components/OperationalSummary";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartPanel } from "@/components/overview/ChartPanel";
import { DateRangeFilter } from "@/components/overview/DateRangeFilter";
import { ExportButton, type ExportRow } from "@/components/overview/ExportButton";
import { GlobalFilters, type FilterOptionGroup } from "@/components/overview/GlobalFilters";
import { KpiCard } from "@/components/overview/KpiCard";
import { HealthScorePanel, type HealthScore } from "@/components/analytics/HealthScorePanel";
import { RecommendationPanel, type Recommendation } from "@/components/analytics/RecommendationPanel";
import { useAuth } from "@/contexts/AuthContext";
import { type TelemetryRow, useAnalyticsSnapshotQuery, useTelemetryRowsQuery } from "@/lib/api";
import { fmtCompactNum, fmtLatency, fmtNum, fmtPercent, fmtUSD } from "@/lib/data";
import { formatLocalDateInputValue } from "@/lib/dates";
import { getRowStatus, useOverviewFilters } from "@/hooks/useOverviewFilters";

const EntityCharts = lazy(() => import("@/components/analytics/EntityCharts").then((module) => ({
  default: function Charts({ data }: { data: TrendPoint[] }) {
    return (
      <>
        <ChartPanel title="Daily Cost Trend" meta="filtered range" isEmpty={data.length === 0}>
          <module.CostTrendChart data={data} />
        </ChartPanel>
        <ChartPanel title="Token Usage Trend" meta="input + output" isEmpty={data.length === 0}>
          <module.TokenTrendChart data={data} />
        </ChartPanel>
        <ChartPanel title="Latency Trend" meta="average ms" isEmpty={data.length === 0}>
          <module.LatencyTrendChart data={data} />
        </ChartPanel>
        <ChartPanel title="Error Rate Trend" meta="daily" isEmpty={data.length === 0}>
          <module.ErrorRateTrendChart data={data} />
        </ChartPanel>
      </>
    );
  },
})));

type SortKey = "cost" | "requests" | "tokens" | "latency";
type TrendPoint = { label: string; cost_usd: number; requests: number; tokens: number; latency_ms: number; error_rate: number };
type ModelAggregate = {
  key: string;
  model: string;
  provider: string;
  requests: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  avg_latency_ms: number;
  error_rate: number;
};

const SORT_LABELS: Record<SortKey, string> = {
  cost: "Total cost",
  requests: "Requests",
  tokens: "Tokens",
  latency: "Avg latency",
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

function aggregateModels(rows: TelemetryRow[]): ModelAggregate[] {
  const grouped = new Map<string, ModelAggregate & { latencyTotal: number; errors: number }>();
  for (const row of rows) {
    const key = `${row.model}::${row.provider}`;
    const current = grouped.get(key) ?? {
      key,
      model: row.model,
      provider: row.provider,
      requests: 0,
      tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      avg_latency_ms: 0,
      error_rate: 0,
      latencyTotal: 0,
      errors: 0,
    };
    current.requests += 1;
    current.tokens += row.total_tokens;
    current.input_tokens += row.input_tokens;
    current.output_tokens += row.output_tokens;
    current.cost_usd += row.cost_usd;
    current.latencyTotal += row.latency_ms;
    current.errors += row.error ? 1 : 0;
    grouped.set(key, current);
  }
  return [...grouped.values()].map((row) => ({
    ...row,
    avg_latency_ms: row.requests > 0 ? row.latencyTotal / row.requests : 0,
    error_rate: row.requests > 0 ? row.errors / row.requests : 0,
  }));
}

function score(value: number, badAt: number): number {
  return Math.max(0, Math.min(100, 100 - (value / badAt) * 100));
}

function buildRecommendations(rows: TelemetryRow[], models: ModelAggregate[]): Recommendation[] {
  if (rows.length === 0) return [];
  const totalCost = rows.reduce((sum, row) => sum + row.cost_usd, 0);
  const avgLatency = rows.reduce((sum, row) => sum + row.latency_ms, 0) / rows.length;
  const avgTokens = rows.reduce((sum, row) => sum + row.total_tokens, 0) / rows.length;
  const top = [...models].sort((a, b) => b.cost_usd - a.cost_usd)[0];
  const slowest = [...models].sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)[0];
  const recs: Recommendation[] = [];

  if (top) {
    recs.push({
      title: `Review ${top.model} usage`,
      detail: "Route high-volume or low-complexity prompts to a faster economy model such as Gemini Flash when quality allows.",
      impact: "Model routing",
      savingsUsd: totalCost * 0.18,
      efficiencyGain: 0.12,
    });
  }
  if (avgTokens > 2500) {
    recs.push({ title: "Reduce max tokens", detail: "Average token volume is high. Lower max output tokens and trim repeated context.", impact: "Token control", savingsUsd: totalCost * 0.12, efficiencyGain: 0.09 });
  }
  if (avgLatency > 1800 || slowest) {
    recs.push({ title: "Use streaming for slower models", detail: `Streaming can improve perceived latency, especially around ${slowest?.model ?? "high-latency models"}.`, impact: "Latency", efficiencyGain: 0.08 });
  }
  recs.push({ title: "Cache repeated prompts", detail: "Cache deterministic system prompts, retrieval results, and stable few-shot context.", impact: "Caching", savingsUsd: totalCost * 0.1, efficiencyGain: 0.07 });
  recs.push({ title: "Batch small requests", detail: "Batch low-priority analysis requests to reduce overhead and smooth provider throughput.", impact: "Throughput", efficiencyGain: 0.06 });
  return recs.slice(0, 5);
}

export default function Models() {
  const { currentWorkspace } = useAuth();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const telemetry = useTelemetryRowsQuery(currentWorkspace?.id);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cost");

  const rows = telemetry.data ?? [];
  const { dateRange, filters, filteredRows, setDateRange, setFilter, clearFilters } = useOverviewFilters(rows, currentWorkspace?.id);

  const filterGroups = useMemo<FilterOptionGroup[]>(() => {
    const dimensions = analytics.data?.dimensions;
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [
      { key: "provider", label: "Provider", options: unique([...(dimensions?.providers ?? []), ...rows.map((row) => row.provider)]) },
      { key: "model", label: "Model", options: unique([...(dimensions?.models ?? []), ...rows.map((row) => row.model)]) },
      { key: "workspace", label: "Workspace", options: unique([currentWorkspace?.id ?? "", ...rows.map((row) => row.workspace_id)]) },
      { key: "status", label: "Status", options: ["200", "429", "500", "ERR"] },
    ];
  }, [analytics.data?.dimensions, currentWorkspace?.id, rows]);

  const modelRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = aggregateModels(filteredRows).filter((row) => !query || row.model.toLowerCase().includes(query) || row.provider.toLowerCase().includes(query));
    return result.sort((left, right) => {
      const leftValue = sortKey === "cost" ? left.cost_usd : sortKey === "requests" ? left.requests : sortKey === "tokens" ? left.tokens : left.avg_latency_ms;
      const rightValue = sortKey === "cost" ? right.cost_usd : sortKey === "requests" ? right.requests : sortKey === "tokens" ? right.tokens : right.avg_latency_ms;
      return rightValue - leftValue || left.model.localeCompare(right.model);
    });
  }, [filteredRows, search, sortKey]);

  const selected = selectedKey ? modelRows.find((row) => row.key === selectedKey) ?? null : null;
  const selectedHistory = selected ? filteredRows.filter((row) => row.model === selected.model && row.provider === selected.provider).sort((a, b) => b.timestamp - a.timestamp) : [];
  const trend = useMemo(() => buildTrend(filteredRows), [filteredRows]);
  const totalCost = filteredRows.reduce((sum, row) => sum + row.cost_usd, 0);
  const totalTokens = filteredRows.reduce((sum, row) => sum + row.total_tokens, 0);
  const avgLatency = filteredRows.length > 0 ? filteredRows.reduce((sum, row) => sum + row.latency_ms, 0) / filteredRows.length : 0;
  const errorRate = filteredRows.length > 0 ? filteredRows.filter((row) => row.error).length / filteredRows.length : 0;
  const recommendations = useMemo(() => buildRecommendations(filteredRows, modelRows), [filteredRows, modelRows]);
  const healthScores: HealthScore[] = [
    { label: "Health Score", value: (score(avgLatency, 4000) + score(errorRate, 0.2)) / 2, detail: "Blends latency and reliability." },
    { label: "Cost Score", value: score(filteredRows.length ? totalCost / filteredRows.length : 0, 0.08), detail: "Lower average request cost scores higher." },
    { label: "Latency Score", value: score(avgLatency, 4000), detail: "Based on average model latency." },
    { label: "Reliability Score", value: score(errorRate, 0.2), detail: "Based on visible request errors." },
    { label: "AI Efficiency", value: (score(avgLatency, 4000) + score(errorRate, 0.2) + score(filteredRows.length ? totalCost / filteredRows.length : 0, 0.08)) / 3, detail: "Composite cost, speed, and reliability." },
  ];
  const providerRows = aggregateModels(filteredRows).reduce<Record<string, { provider: string; requests: number; tokens: number; cost_usd: number; latency: number; errors: number }>>((acc, row) => {
    acc[row.provider] ??= { provider: row.provider, requests: 0, tokens: 0, cost_usd: 0, latency: 0, errors: 0 };
    acc[row.provider].requests += row.requests;
    acc[row.provider].tokens += row.tokens;
    acc[row.provider].cost_usd += row.cost_usd;
    acc[row.provider].latency += row.avg_latency_ms * row.requests;
    acc[row.provider].errors += Math.round(row.error_rate * row.requests);
    return acc;
  }, {});
  const providerList = Object.values(providerRows).sort((a, b) => b.cost_usd - a.cost_usd);
  const mostExpensiveModel = [...modelRows].sort((a, b) => b.cost_usd - a.cost_usd)[0] ?? null;
  const highestLatencyModel = [...modelRows].sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)[0] ?? null;
  const fastestProvider = [...providerList].filter((row) => row.requests > 0).sort((a, b) => (a.latency / a.requests) - (b.latency / b.requests))[0] ?? null;
  const efficientProvider = [...providerList].filter((row) => row.requests > 0).sort((a, b) => (a.cost_usd / a.requests) - (b.cost_usd / b.requests))[0] ?? null;
  const lastActivityAt = filteredRows.length > 0 ? Math.max(...filteredRows.map((row) => row.timestamp)) : null;
  const summaryItems: OperationalSummaryItem[] = [
    { label: "Tracked models", value: fmtNum(modelRows.length), detail: `${fmtNum(providerList.length)} providers` },
    { label: "Most expensive", value: mostExpensiveModel?.model ?? "none", detail: mostExpensiveModel ? fmtUSD(mostExpensiveModel.cost_usd) : "no model spend" },
    { label: "Highest latency", value: highestLatencyModel?.model ?? "none", detail: highestLatencyModel ? fmtLatency(highestLatencyModel.avg_latency_ms) : "no latency data", tone: highestLatencyModel && highestLatencyModel.avg_latency_ms > 2500 ? "warn" : "neutral" },
    { label: "Fastest provider", value: fastestProvider?.provider ?? "none", detail: fastestProvider ? fmtLatency(fastestProvider.latency / fastestProvider.requests) : "no provider data", tone: "good" },
    { label: "Most efficient", value: efficientProvider?.provider ?? "none", detail: efficientProvider ? `${fmtUSD(efficientProvider.cost_usd / efficientProvider.requests)} avg` : "no cost data" },
    { label: "Last activity", value: lastActivityAt ? new Date(lastActivityAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "none", detail: lastActivityAt ? new Date(lastActivityAt).toLocaleDateString() : "waiting for telemetry" },
  ];
  const exportRows: ExportRow[] = filteredRows.map((row) => ({
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
      <AppLayout title="Models" meta="loading analytics...">
        <PageLoadingState rows={5} />
      </AppLayout>
    );
  }

  if (analytics.isError || telemetry.isError || !analytics.data) {
    return (
      <AppLayout title="Models" meta="backend unavailable">
        <PageErrorState title="Could not load models" message="The analytics API is unavailable. Start the backend and reload the dashboard." />
      </AppLayout>
    );
  }

  return (
    <>
      <AppLayout title="Models" meta={`${modelRows.length} models tracked`}>
        <div className="sticky top-0 z-20 -mx-4 mb-8 border-y border-hairline bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search models or providers" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none sm:max-w-xs" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
              <GlobalFilters groups={filterGroups} values={filters} onChange={setFilter} onClear={clearFilters} />
              <ExportButton 
                rows={exportRows} 
                disabled={filteredRows.length === 0}
                workspaceId={currentWorkspace?.id}
                dateRange={dateRange}
                filters={filters}
              />
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {Object.entries(SORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <OperationalSummary items={summaryItems} />

        <div className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Requests" value={fmtNum(filteredRows.length)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => point.requests)} tooltip="Visible model requests." isEmpty={filteredRows.length === 0} />
          <KpiCard title="Total Tokens" value={fmtCompactNum(totalTokens)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => point.tokens)} tooltip="Input and output tokens for visible model traffic." isEmpty={filteredRows.length === 0} />
          <KpiCard title="Total Cost" value={fmtUSD(totalCost)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => point.cost_usd)} tooltip="Total visible model cost." isEmpty={filteredRows.length === 0} />
          <KpiCard title="Error Rate" value={fmtPercent(errorRate)} previousValue="filtered" changePercent={0} sparkline={trend.map((point) => point.error_rate)} tooltip="Visible model error rate." isEmpty={filteredRows.length === 0} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-10 xl:grid-cols-2">
          <Suspense fallback={Array.from({ length: 4 }).map((_, index) => <ChartPanel key={index} title="Loading chart" isLoading><Skeleton className="h-[260px]" /></ChartPanel>)}>
            <EntityCharts data={trend} />
          </Suspense>
        </div>

        <div className="mt-12">
          <HealthScorePanel title="Model Health" scores={healthScores} />
        </div>

        <div className="mt-12">
          <RecommendationPanel title="AI Recommendations" recommendations={recommendations} isEmpty={filteredRows.length === 0} />
        </div>

        <section className="mt-12 border-t border-hairline pt-5">
          <h2 className="mb-4 font-serif text-xl">Provider Comparison</h2>
          <DataTable
            columns={[
              { key: "provider", label: "Provider", render: (row) => <span className="font-mono">{row.provider}</span> },
              { key: "cost_usd", label: "Cost", align: "right", render: (row) => fmtUSD(row.cost_usd) },
              { key: "latency", label: "Latency", align: "right", render: (row) => fmtLatency(row.requests > 0 ? row.latency / row.requests : 0) },
              { key: "tokens", label: "Tokens", align: "right", render: (row) => fmtCompactNum(row.tokens) },
              { key: "errors", label: "Error rate", align: "right", render: (row) => fmtPercent(row.requests > 0 ? row.errors / row.requests : 0) },
              { key: "requests", label: "Requests", align: "right", render: (row) => fmtNum(row.requests) },
            ]}
            rows={Object.values(providerRows).sort((a, b) => b.cost_usd - a.cost_usd)}
            summaryRows={[{
              provider: "Provider total",
              requests: providerList.reduce((sum, row) => sum + row.requests, 0),
              tokens: providerList.reduce((sum, row) => sum + row.tokens, 0),
              cost_usd: providerList.reduce((sum, row) => sum + row.cost_usd, 0),
              latency: providerList.reduce((sum, row) => sum + row.latency, 0),
              errors: providerList.reduce((sum, row) => sum + row.errors, 0),
            }]}
            getRowKey={(row) => row.provider}
          />
        </section>

        <section className="mt-12">
          {modelRows.length === 0 ? (
            <div className="border-t border-hairline py-8 text-center text-sm text-muted-foreground">No model telemetry matches the active filters.</div>
          ) : (
            <DataTable
              columns={[
                { key: "model", label: "Model", render: (row) => <div className="space-y-1"><div className="font-mono text-sm">{row.model}</div><Badge variant="outline" className="rounded-sm border-hairline bg-secondary/40 px-2 py-0 text-[10px] uppercase tracking-[0.2em]">{row.provider}</Badge></div> },
                { key: "requests", label: "Requests", align: "right", render: (row) => fmtNum(row.requests) },
                { key: "tokens", label: "Tokens", align: "right", render: (row) => fmtCompactNum(row.tokens) },
                { key: "avg_latency_ms", label: "Avg latency", align: "right", render: (row) => fmtLatency(row.avg_latency_ms) },
                { key: "error_rate", label: "Error rate", align: "right", render: (row) => fmtPercent(row.error_rate) },
                { key: "cost_usd", label: "Cost", align: "right", render: (row) => fmtUSD(row.cost_usd) },
              ]}
              rows={modelRows}
              summaryRows={[{
                key: "summary",
                model: "Model total",
                provider: "",
                requests: modelRows.reduce((sum, row) => sum + row.requests, 0),
                tokens: modelRows.reduce((sum, row) => sum + row.tokens, 0),
                input_tokens: modelRows.reduce((sum, row) => sum + row.input_tokens, 0),
                output_tokens: modelRows.reduce((sum, row) => sum + row.output_tokens, 0),
                cost_usd: modelRows.reduce((sum, row) => sum + row.cost_usd, 0),
                avg_latency_ms: modelRows.length ? modelRows.reduce((sum, row) => sum + row.avg_latency_ms * row.requests, 0) / Math.max(1, modelRows.reduce((sum, row) => sum + row.requests, 0)) : 0,
                error_rate: modelRows.length ? modelRows.reduce((sum, row) => sum + row.error_rate * row.requests, 0) / Math.max(1, modelRows.reduce((sum, row) => sum + row.requests, 0)) : 0,
              }]}
              onRowClick={(row) => setSelectedKey(row.key)}
              getRowKey={(row) => row.key}
            />
          )}
        </section>
      </AppLayout>

      <Drawer open={Boolean(selected)} onClose={() => setSelectedKey(null)} title={selected ? `${selected.model} · ${selected.provider}` : undefined}>
        {selected && (
          <div className="space-y-8">
            <HealthScorePanel title="Selected Model Health" scores={[
              { label: "Cost Score", value: score(selected.requests ? selected.cost_usd / selected.requests : 0, 0.08), detail: "Average request cost." },
              { label: "Latency Score", value: score(selected.avg_latency_ms, 4000), detail: "Average latency." },
              { label: "Reliability", value: score(selected.error_rate, 0.2), detail: "Error-free request share." },
              { label: "Efficiency", value: (score(selected.avg_latency_ms, 4000) + score(selected.error_rate, 0.2)) / 2, detail: "Composite score." },
            ]} />
            <DataTable
              columns={[
                { key: "timestamp", label: "Timestamp", render: (row) => <span className="font-mono text-xs">{new Date(row.timestamp).toLocaleString()}</span> },
                { key: "route", label: "Endpoint", render: (row) => <span className="font-mono">{row.route}</span> },
                { key: "total_tokens", label: "Tokens", align: "right", render: (row) => fmtCompactNum(row.total_tokens) },
                { key: "latency_ms", label: "Latency", align: "right", render: (row) => fmtLatency(row.latency_ms) },
                { key: "cost_usd", label: "Cost", align: "right", render: (row) => fmtUSD(row.cost_usd) },
                { key: "error", label: "Status", align: "right", render: (row) => <span className={`font-mono text-xs ${row.error ? "text-negative" : ""}`}>{getRowStatus(row)}</span> },
              ]}
              rows={selectedHistory.slice(0, 50)}
              getRowKey={(row) => String(row.id)}
            />
          </div>
        )}
      </Drawer>
    </>
  );
}

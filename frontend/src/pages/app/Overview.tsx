import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { BudgetAlertCard } from "@/components/BudgetAlertCard";
import { RequestDetailDrawer } from "@/components/RequestDetailDrawer";
import { SdkOnboarding } from "@/components/SdkOnboarding";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { ChartPanel } from "@/components/overview/ChartPanel";
import { DateRangeFilter } from "@/components/overview/DateRangeFilter";
import { ExportButton, type ExportRow } from "@/components/overview/ExportButton";
import { GlobalFilters, type FilterOptionGroup } from "@/components/overview/GlobalFilters";
import { KpiCard } from "@/components/overview/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { type TelemetryRow, useAnalyticsSnapshotQuery, useTelemetryRowsQuery } from "@/lib/api";
import { fmtCompactNum, fmtNum, fmtPercent, fmtRelativeTime, fmtUSD } from "@/lib/data";
import { formatLocalDateInputValue } from "@/lib/dates";
import { useAuth } from "@/contexts/AuthContext";
import { useStatus } from "@/contexts/StatusContext";
import { getRowStatus, useOverviewFilters } from "@/hooks/useOverviewFilters";

const OverviewCharts = lazy(() => import("@/components/overview/OverviewCharts").then((module) => ({ default: moduleCharts(module) })));

function moduleCharts(module: typeof import("@/components/overview/OverviewCharts")) {
  return function Charts(props: OverviewChartsProps) {
    return (
      <>
        <ChartPanel title="Daily Cost Trend" meta="filtered range" isEmpty={props.timeline.length === 0}>
          <module.DailyCostTrendChart data={props.timeline} />
        </ChartPanel>
        <ChartPanel title="Daily Request Trend" meta="filtered range" isEmpty={props.timeline.length === 0}>
          <module.DailyRequestTrendChart data={props.timeline} />
        </ChartPanel>
        <ChartPanel title="Provider Distribution" meta="by cost" isEmpty={props.providers.length === 0}>
          <module.ProviderDistributionChart data={props.providers} />
        </ChartPanel>
        <ChartPanel title="Cost by Model" meta="top 8" isEmpty={props.models.length === 0}>
          <module.HorizontalCostBarChart data={props.models} />
        </ChartPanel>
        <ChartPanel title="Cost by Endpoint" meta="top 8" isEmpty={props.endpoints.length === 0}>
          <module.HorizontalCostBarChart data={props.endpoints} />
        </ChartPanel>
      </>
    );
  };
}

interface OverviewChartsProps {
  timeline: Array<{ label: string; requests: number; cost_usd: number }>;
  providers: Array<{ name: string; value: number; requests: number }>;
  models: Array<{ name: string; value: number; requests: number }>;
  endpoints: Array<{ name: string; value: number; requests: number }>;
}

function sum(rows: TelemetryRow[], selector: (row: TelemetryRow) => number): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function dateKey(timestamp: number): string {
  return formatLocalDateInputValue(new Date(timestamp));
}

function compactDateLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function previousPeriodRows(rows: TelemetryRow[], filteredRows: TelemetryRow[]): TelemetryRow[] {
  if (filteredRows.length === 0) return [];
  const from = Math.min(...filteredRows.map((row) => row.timestamp));
  const to = Math.max(...filteredRows.map((row) => row.timestamp));
  const span = Math.max(24 * 60 * 60 * 1000, to - from + 1);
  return rows.filter((row) => row.timestamp >= from - span && row.timestamp < from);
}

function groupCost(rows: TelemetryRow[], key: (row: TelemetryRow) => string, limit = 8) {
  const grouped = new Map<string, { name: string; value: number; requests: number }>();
  for (const row of rows) {
    const name = key(row) || "unknown";
    const current = grouped.get(name) ?? { name, value: 0, requests: 0 };
    current.value += row.cost_usd;
    current.requests += 1;
    grouped.set(name, current);
  }
  return [...grouped.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

export default function Overview() {
  const { currentWorkspace } = useAuth();
  const { streamStatus, lastTelemetryEventAt } = useStatus();
  const navigate = useNavigate();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const telemetry = useTelemetryRowsQuery(currentWorkspace?.id, 500);
  const [selectedRequest, setSelectedRequest] = useState<TelemetryRow | null>(null);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const rows = telemetry.data ?? [];
  const {
    dateRange,
    filters,
    filteredRows,
    hasActiveFilters,
    setDateRange,
    setFilter,
    clearFilters,
  } = useOverviewFilters(rows, currentWorkspace?.id);

  const previousRows = useMemo(() => previousPeriodRows(rows, filteredRows), [filteredRows, rows]);
  const overview = analytics.data?.overview;
  const isLoading = (analytics.isLoading || telemetry.isLoading) && rows.length === 0 && !analytics.data;
  const isError = analytics.isError || telemetry.isError || !analytics.data;
  const hasData = filteredRows.length > 0;
  const lastUpdatedAt = Math.max(analytics.dataUpdatedAt ?? 0, telemetry.dataUpdatedAt ?? 0, lastTelemetryEventAt ?? 0);
  const relativeTime = fmtRelativeTime(lastUpdatedAt || Date.now());
  const metaLabel = streamStatus === "offline" ? `updated ${relativeTime} | offline` : streamStatus === "reconnecting" ? `updated ${relativeTime} | reconnecting` : `updated ${relativeTime} | ${streamStatus}`;

  const filterGroups = useMemo<FilterOptionGroup[]>(() => {
    const dimensions = analytics.data?.dimensions;
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [
      { key: "provider", label: "Provider", options: unique([...(dimensions?.providers ?? []), ...rows.map((row) => row.provider)]) },
      { key: "workspace", label: "Workspace", options: unique([currentWorkspace?.id ?? "", ...rows.map((row) => row.workspace_id)]) },
      { key: "model", label: "Model", options: unique([...(dimensions?.models ?? []), ...rows.map((row) => row.model)]) },
      { key: "endpoint", label: "Endpoint", options: unique([...(dimensions?.routes ?? []), ...rows.map((row) => row.route)]) },
      { key: "status", label: "Status", options: ["200", "429", "500", "ERR"] },
    ];
  }, [analytics.data?.dimensions, currentWorkspace?.id, rows]);

  const metrics = useMemo(() => {
    const totalCost = sum(filteredRows, (row) => row.cost_usd);
    const totalRequests = filteredRows.length;
    const avgCost = totalRequests > 0 ? totalCost / totalRequests : 0;
    const failures = filteredRows.filter((row) => row.error).length;
    const previousCost = sum(previousRows, (row) => row.cost_usd);
    const previousRequests = previousRows.length;
    const previousAvgCost = previousRequests > 0 ? previousCost / previousRequests : 0;
    const previousFailures = previousRows.filter((row) => row.error).length;
    const topModels = groupCost(filteredRows, (row) => row.model, 1);
    const topEndpoints = groupCost(filteredRows, (row) => row.route, 1);

    return {
      totalCost,
      totalRequests,
      avgCost,
      errorRate: totalRequests > 0 ? failures / totalRequests : 0,
      previousCost,
      previousRequests,
      previousAvgCost,
      previousErrorRate: previousRequests > 0 ? previousFailures / previousRequests : 0,
      topModel: topModels[0],
      topEndpoint: topEndpoints[0],
    };
  }, [filteredRows, previousRows]);

  const chartData = useMemo<OverviewChartsProps>(() => {
    const daily = new Map<string, { label: string; requests: number; cost_usd: number }>();
    for (const row of filteredRows) {
      const key = dateKey(row.timestamp);
      const current = daily.get(key) ?? { label: compactDateLabel(key), requests: 0, cost_usd: 0 };
      current.requests += 1;
      current.cost_usd += row.cost_usd;
      daily.set(key, current);
    }
    return {
      timeline: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
      providers: groupCost(filteredRows, (row) => row.provider, 7),
      models: groupCost(filteredRows, (row) => row.model, 8),
      endpoints: groupCost(filteredRows, (row) => row.route, 8),
    };
  }, [filteredRows]);

  const sparkline = chartData.timeline.map((point) => point.cost_usd);
  const requestSparkline = chartData.timeline.map((point) => point.requests);
  const exportRows = useMemo<ExportRow[]>(
    () =>
      filteredRows.map((row) => ({
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
      })),
    [filteredRows],
  );

  const recentRows = filteredRows.slice(0, 8);
  const budget = overview?.budget ?? Number(currentWorkspace?.settings?.alert_cost_threshold) ?? 0;
  const budgetUsedPercent = budget > 0 ? Math.min(100, Math.round((metrics.totalCost / budget) * 100)) : 0;
  const budgetRemaining = Math.max(0, budget - metrics.totalCost);
  const hasWorkspaceTelemetry =
    Boolean(analytics.data) &&
    ((analytics.data?.dimensions.models.length ?? 0) > 0 ||
      (analytics.data?.dimensions.providers.length ?? 0) > 0 ||
      (analytics.data?.dimensions.routes.length ?? 0) > 0 ||
      rows.length > 0);

  if (isLoading) {
    return (
      <AppLayout title="Overview" meta="loading analytics...">
        <PageLoadingState rows={6} />
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout title="Overview" meta="backend unavailable">
        <PageErrorState
          title="Could not load analytics"
          message="The backend API is unreachable. Confirm TokenWatch backend is running on port 3001, then refresh."
        />
      </AppLayout>
    );
  }

  return (
    <>
      <AppLayout title="Overview" meta={metaLabel}>
        {!hasWorkspaceTelemetry && currentWorkspace && (
          <div className="mb-10">
            <SdkOnboarding workspace={currentWorkspace} />
          </div>
        )}

        <div className="sticky top-0 z-20 -mx-4 mb-8 border-y border-hairline bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
              <span>stream {streamStatus}</span>
              <span>{lastTelemetryEventAt ? `last telemetry ${fmtRelativeTime(lastTelemetryEventAt + clockTick * 0)}` : "waiting for first telemetry event"}</span>
              {hasActiveFilters && <span>{fmtNum(filteredRows.length)} visible rows</span>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
              <GlobalFilters groups={filterGroups} values={filters} onChange={setFilter} onClear={clearFilters} />
              <ExportButton 
                rows={exportRows} 
                disabled={!hasData}
                workspaceId={currentWorkspace?.id}
                dateRange={dateRange}
                filters={filters}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Total Cost"
            value={fmtUSD(metrics.totalCost)}
            previousValue={fmtUSD(metrics.previousCost)}
            changePercent={percentChange(metrics.totalCost, metrics.previousCost)}
            sparkline={sparkline}
            tooltip="Total visible telemetry cost after date range and global filters."
            isEmpty={!hasData}
            onClick={() => navigate(`/app/requests?sort=cost&from=${dateRange.from}&to=${dateRange.to}`)}
          />
          <KpiCard
            title="Requests"
            value={fmtCompactNum(metrics.totalRequests)}
            previousValue={fmtCompactNum(metrics.previousRequests)}
            changePercent={percentChange(metrics.totalRequests, metrics.previousRequests)}
            sparkline={requestSparkline}
            tooltip="Visible request volume for the selected date range."
            isEmpty={!hasData}
            onClick={() => navigate(`/app/requests?from=${dateRange.from}&to=${dateRange.to}`)}
          />
          <KpiCard
            title="Avg Cost / Request"
            value={metrics.totalRequests > 0 ? fmtUSD(metrics.avgCost) : "$0.00"}
            previousValue={metrics.previousRequests > 0 ? fmtUSD(metrics.previousAvgCost) : "$0.00"}
            changePercent={percentChange(metrics.avgCost, metrics.previousAvgCost)}
            sparkline={sparkline}
            tooltip="Average cost per visible request."
            isEmpty={!hasData}
            onClick={() => navigate(`/app/requests?sort=avgCost&from=${dateRange.from}&to=${dateRange.to}`)}
          />
          <KpiCard
            title="Errors"
            value={fmtPercent(metrics.errorRate)}
            previousValue={fmtPercent(metrics.previousErrorRate)}
            changePercent={percentChange(metrics.errorRate, metrics.previousErrorRate)}
            sparkline={chartData.timeline.map((point) => point.requests)}
            tooltip="Error rate across visible requests."
            isEmpty={!hasData}
            onClick={() => navigate(`/app/requests?status=ERR&from=${dateRange.from}&to=${dateRange.to}`)}
          />
          <KpiCard
            title="Budget Usage"
            value={`${budgetUsedPercent}%`}
            previousValue={`${Math.max(0, Math.round(percentChange(metrics.previousCost, budget || 1)))}%`}
            changePercent={percentChange(metrics.totalCost, metrics.previousCost)}
            sparkline={sparkline}
            tooltip={`Spent ${fmtUSD(metrics.totalCost)} with ${fmtUSD(budgetRemaining)} remaining in the selected range.`}
            isEmpty={!hasData}
            onClick={() => navigate("/app/settings")}
          />
          <KpiCard
            title="Top Model"
            value={metrics.topModel?.name ?? "None"}
            previousValue={metrics.topModel ? fmtUSD(metrics.topModel.value) : "$0.00"}
            changePercent={0}
            sparkline={sparkline}
            tooltip="Highest cost model in the visible telemetry."
            isEmpty={!metrics.topModel}
            onClick={() => navigate(metrics.topModel ? `/app/models?model=${encodeURIComponent(metrics.topModel.name)}` : "/app/models")}
          />
          <KpiCard
            title="Top Endpoint"
            value={metrics.topEndpoint?.name ?? "None"}
            previousValue={metrics.topEndpoint ? fmtUSD(metrics.topEndpoint.value) : "$0.00"}
            changePercent={0}
            sparkline={sparkline}
            tooltip="Highest cost endpoint in the visible telemetry."
            isEmpty={!metrics.topEndpoint}
            onClick={() => navigate(metrics.topEndpoint ? `/app/endpoints?route=${encodeURIComponent(metrics.topEndpoint.name)}` : "/app/endpoints")}
          />
        </div>

        <div className="mt-2">
          <BudgetAlertCard
            spendToday={metrics.totalCost}
            monthlyBudget={overview?.budget ?? 0}
            alertThresholdPercent={Number(currentWorkspace?.settings?.alert_cost_threshold) || undefined}
          />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 xl:grid-cols-2">
          <Suspense
            fallback={Array.from({ length: 5 }).map((_, index) => (
              <ChartPanel key={index} title="Loading chart" isLoading>
                <Skeleton className="h-[260px] w-full" />
              </ChartPanel>
            ))}
          >
            <OverviewCharts {...chartData} />
          </Suspense>
        </div>

        <section className="mt-14">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-xl">Recent activity</h2>
            <div className="label-mono">live · last 8 visible</div>
          </div>
          {recentRows.length > 0 ? (
            <ul className="border-t border-hairline">
              {recentRows.map((row) => {
                const status = getRowStatus(row);
                return (
                  <li
                    key={row.id}
                    onClick={() => setSelectedRequest(row)}
                    className="grid cursor-pointer grid-cols-12 items-center gap-2 border-b border-hairline/60 py-2 text-xs transition hover:bg-secondary/40 hover:shadow-sm"
                  >
                    <span className="col-span-1 flex items-center justify-start">
                      <span className={`mr-2 h-2 w-2 rounded-full ${status === "200" ? "bg-green-500" : "bg-amber-600"}`} />
                    </span>
                    <span className="col-span-3 truncate font-mono text-muted-foreground" title={new Date(row.timestamp).toISOString()}>{fmtRelativeTime(row.timestamp)}</span>
                    <span className="col-span-4 truncate font-mono">{row.route}</span>
                    <span className="col-span-2 truncate font-mono text-muted-foreground">{row.model}/{row.provider}</span>
                    <span className={`col-span-2 text-right num ${row.error ? "text-amber-600" : ""}`}>{fmtUSD(row.cost_usd)}</span>
                    <span className="col-span-12 -mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>{status}</span>
                      <span>{fmtCompactNum(row.total_tokens)} tok</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-t border-hairline py-8 text-center text-xs text-muted-foreground">
              No recent telemetry matches the selected date range and filters.
            </div>
          )}
        </section>
      </AppLayout>
      <RequestDetailDrawer open={Boolean(selectedRequest)} request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </>
  );
}

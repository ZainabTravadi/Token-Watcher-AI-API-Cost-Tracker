import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Pause, Play, Radio, RotateCcw } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { DataTable, type DataTableSort } from "@/components/DataTable";
import { RequestDetailDrawer } from "@/components/RequestDetailDrawer";
import { SearchInput } from "@/components/SearchInput";
import { SdkOnboarding } from "@/components/SdkOnboarding";
import { OperationalSummary, type OperationalSummaryItem } from "@/components/OperationalSummary";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { DateRangeFilter } from "@/components/overview/DateRangeFilter";
import { ExportButton, type ExportRow } from "@/components/overview/ExportButton";
import { GlobalFilters, type FilterOptionGroup } from "@/components/overview/GlobalFilters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useStatus } from "@/contexts/StatusContext";
import { getPresetRange, getRowStatus, type OverviewFilters } from "@/hooks/useOverviewFilters";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  setRequestLogRefreshEnabled,
  type RequestLogQuery,
  type TelemetryRow,
  useAnalyticsSnapshotQuery,
  useRequestLogQuery,
} from "@/lib/api";
import { fmtCompactNum, fmtLatency, fmtNum, fmtRelativeTime, fmtUSD } from "@/lib/data";

const PAGE_SIZES = [25, 50, 100] as const;
const STATUS_OPTIONS = ["success", "error", "429", "500"];

type SortKey = NonNullable<RequestLogQuery["sortBy"]>;

function getStatusLabel(error: string | null): string {
  if (!error) return "200";
  const normalized = error.toLowerCase();
  if (normalized.includes("429")) return "429";
  if (normalized.includes("500")) return "500";
  return "ERR";
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function numericValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Highlight({ value, query, className = "" }: { value: string | number | null | undefined; query: string; className?: string }) {
  const text = value === null || value === undefined ? "" : String(value);
  const needle = query.trim();
  if (!needle) return <span className={className}>{text}</span>;

  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {text.slice(0, index)}
      <mark className="bg-amber-200/70 px-0.5 text-foreground">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </span>
  );
}

function exportRow(row: TelemetryRow): ExportRow {
  return {
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
  };
}

export default function Requests() {
  const { currentWorkspace } = useAuth();
  const { streamStatus, streamStatusColor, lastTelemetryEventAt } = useStatus();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [filters, setFilters] = useState<OverviewFilters>({
    provider: [],
    workspace: [],
    model: [],
    endpoint: [],
    status: [],
  });
  const [dateRange, setDateRange] = useState(getPresetRange("7d"));
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sort, setSort] = useState<DataTableSort>({ key: "timestamp", direction: "desc" });
  const [selectedRequest, setSelectedRequest] = useState<TelemetryRow | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [eventCount, setEventCount] = useState(0);
  const [newRowIds, setNewRowIds] = useState<Set<number>>(new Set());
  const [minLatency, setMinLatency] = useState("");
  const [maxLatency, setMaxLatency] = useState("");
  const [minCost, setMinCost] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const [minTokens, setMinTokens] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const topRef = useRef<HTMLDivElement | null>(null);
  const previousRowIds = useRef<Set<number>>(new Set());
  const lastEventRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSort = params.get("sort");
    if (urlSort === "cost" || urlSort === "latency" || urlSort === "tokens" || urlSort === "provider" || urlSort === "model" || urlSort === "endpoint" || urlSort === "status") {
      setSort({ key: urlSort, direction: "desc" });
    }
    const from = params.get("from");
    const to = params.get("to");
    if (from && to) {
      setDateRange({ preset: "custom", from, to });
    }
    const status = params.getAll("status");
    if (status.length > 0) {
      setFilters((current) => ({ ...current, status }));
    }
  }, []);

  useEffect(() => {
    setRequestLogRefreshEnabled(!paused);
    return () => setRequestLogRefreshEnabled(true);
  }, [paused]);

  useEffect(() => {
    if (!lastTelemetryEventAt || lastEventRef.current === lastTelemetryEventAt) return;
    lastEventRef.current = lastTelemetryEventAt;
    if (!paused) {
      setEventCount((count) => count + 1);
    }
  }, [lastTelemetryEventAt, paused]);

  useEffect(() => {
    setPage(1);
  }, [
    currentWorkspace?.id,
    debouncedSearch,
    filters.endpoint,
    filters.model,
    filters.provider,
    filters.status,
    filters.workspace,
    dateRange.from,
    dateRange.to,
    limit,
    minCost,
    maxCost,
    minLatency,
    maxLatency,
    minTokens,
    maxTokens,
  ]);

  const query = useMemo<RequestLogQuery>(() => ({
    page,
    limit,
    endpoints: filters.endpoint,
    providers: filters.provider,
    model: filters.model,
    workspace: filters.workspace,
    status: filters.status,
    search: debouncedSearch.trim() || undefined,
    from: dateRange.from,
    to: dateRange.to,
    minLatency: numericValue(minLatency),
    maxLatency: numericValue(maxLatency),
    minCost: numericValue(minCost),
    maxCost: numericValue(maxCost),
    minTokens: numericValue(minTokens),
    maxTokens: numericValue(maxTokens),
    sortBy: sort.key as SortKey,
    sortDir: sort.direction,
  }), [dateRange.from, dateRange.to, debouncedSearch, filters.endpoint, filters.model, filters.provider, filters.status, filters.workspace, limit, maxCost, maxLatency, maxTokens, minCost, minLatency, minTokens, page, sort.direction, sort.key]);

  const requestLog = useRequestLogQuery(currentWorkspace?.id, query);
  const rows = useMemo(() => requestLog.data?.data ?? [], [requestLog.data?.data]);
  const isInitialLoading = analytics.isLoading || (requestLog.isLoading && rows.length === 0);

  useEffect(() => {
    const currentIds = new Set(rows.map((row) => row.id));
    const added = rows.filter((row) => !previousRowIds.current.has(row.id)).map((row) => row.id);
    previousRowIds.current = currentIds;
    if (added.length > 0 && requestLog.dataUpdatedAt > 0) {
      setNewRowIds(new Set(added));
      const timer = window.setTimeout(() => setNewRowIds(new Set()), 1400);
      return () => window.clearTimeout(timer);
    }
  }, [requestLog.dataUpdatedAt, rows]);

  useEffect(() => {
    if (autoScroll && !paused && page === 1 && sort.key === "timestamp" && sort.direction === "desc") {
      topRef.current?.scrollIntoView({ block: "start" });
    }
  }, [autoScroll, lastTelemetryEventAt, page, paused, sort.direction, sort.key]);

  useEffect(() => {
    if (!selectedRequest) return;
    const updated = rows.find((row) => row.id === selectedRequest.id);
    if (updated) setSelectedRequest(updated);
  }, [rows, selectedRequest]);

  const routeOptions = useMemo(() => analytics.data?.dimensions.routes ?? [], [analytics.data?.dimensions.routes]);
  const modelOptions = useMemo(() => analytics.data?.dimensions.models ?? [], [analytics.data?.dimensions.models]);
  const providerOptions = useMemo(() => analytics.data?.dimensions.providers ?? [], [analytics.data?.dimensions.providers]);
  const workspaceOptions = useMemo(() => unique([currentWorkspace?.id ?? "", ...rows.map((row) => row.workspace_id)]), [currentWorkspace?.id, rows]);

  const filterGroups = useMemo<FilterOptionGroup[]>(() => [
    { key: "provider", label: "Provider", options: unique([...providerOptions, ...rows.map((row) => row.provider)]) },
    { key: "model", label: "Model", options: unique([...modelOptions, ...rows.map((row) => row.model)]) },
    { key: "endpoint", label: "Endpoint", options: unique([...routeOptions, ...rows.map((row) => row.route)]) },
    { key: "status", label: "Status", options: STATUS_OPTIONS },
    { key: "workspace", label: "Workspace", options: workspaceOptions },
  ], [modelOptions, providerOptions, routeOptions, rows, workspaceOptions]);

  const totalPages = requestLog.data ? Math.max(1, Math.ceil(requestLog.data.total / requestLog.data.limit)) : 1;
  const from = requestLog.data ? (requestLog.data.total === 0 ? 0 : (requestLog.data.page - 1) * requestLog.data.limit + 1) : 0;
  const to = requestLog.data ? Math.min(requestLog.data.page * requestLog.data.limit, requestLog.data.total) : 0;
  const hasWorkspaceTelemetry = routeOptions.length > 0 || modelOptions.length > 0 || providerOptions.length > 0 || rows.length > 0;
  const hasActiveFilters = Object.values(filters).some((items) => items.length > 0) || Boolean(debouncedSearch.trim()) || minLatency || maxLatency || minCost || maxCost || minTokens || maxTokens;

  const exportRows = useMemo(() => rows.map(exportRow), [rows]);
  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
    filters.provider.forEach((value) => params.append("provider", value));
    filters.model.forEach((value) => params.append("model", value));
    filters.endpoint.forEach((value) => params.append("endpoint", value));
    filters.status.forEach((value) => params.append("status", value));
    filters.workspace.forEach((value) => params.append("workspace", value));
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (minLatency) params.set("minLatency", minLatency);
    if (maxLatency) params.set("maxLatency", maxLatency);
    if (minCost) params.set("minCost", minCost);
    if (maxCost) params.set("maxCost", maxCost);
    if (minTokens) params.set("minTokens", minTokens);
    if (maxTokens) params.set("maxTokens", maxTokens);
    params.set("sortBy", sort.key);
    params.set("sortDir", sort.direction);
    return params;
  }, [dateRange.from, dateRange.to, debouncedSearch, filters.endpoint, filters.model, filters.provider, filters.status, filters.workspace, maxCost, maxLatency, maxTokens, minCost, minLatency, minTokens, sort.direction, sort.key]);

  const pageSummary = useMemo(() => {
    const requests = rows.length;
    const errors = rows.filter((row) => row.error).length;
    const totalCost = rows.reduce((sum, row) => sum + row.cost_usd, 0);
    const totalTokens = rows.reduce((sum, row) => sum + row.total_tokens, 0);
    const avgLatency = requests > 0 ? rows.reduce((sum, row) => sum + row.latency_ms, 0) / requests : 0;
    const errorRate = requests > 0 ? errors / requests : 0;
    return { requests, errors, totalCost, totalTokens, avgLatency, errorRate };
  }, [rows]);

  const summaryItems: OperationalSummaryItem[] = [
    { label: "Live throughput", value: fmtNum(pageSummary.requests), detail: "rows on current page", tone: paused ? "warn" : "good" },
    { label: "Avg latency", value: fmtLatency(pageSummary.avgLatency), detail: "current page mean", tone: pageSummary.avgLatency > 2500 ? "warn" : "neutral" },
    { label: "Error rate", value: `${(pageSummary.errorRate * 100).toFixed(2)}%`, detail: `${fmtNum(pageSummary.errors)} failed`, tone: pageSummary.errorRate > 0.05 ? "bad" : pageSummary.errorRate > 0 ? "warn" : "good" },
    { label: "Cost", value: fmtUSD(pageSummary.totalCost), detail: "visible page spend" },
    { label: "Tokens", value: fmtCompactNum(pageSummary.totalTokens), detail: "input + output" },
    { label: "Filters", value: hasActiveFilters ? "active" : "none", detail: `${fmtNum(requestLog.data?.total ?? 0)} total matches`, tone: hasActiveFilters ? "warn" : "neutral" },
  ];

  const setFilter = (key: keyof OverviewFilters, values: string[]) => {
    setFilters((current) => ({ ...current, [key]: values }));
  };

  const clearFilters = () => {
    setFilters({ provider: [], workspace: [], model: [], endpoint: [], status: [] });
    setSearch("");
    setMinLatency("");
    setMaxLatency("");
    setMinCost("");
    setMaxCost("");
    setMinTokens("");
    setMaxTokens("");
  };

  if (isInitialLoading) {
    return (
      <AppLayout title="Request log" meta="loading telemetry...">
        <PageLoadingState rows={8} />
      </AppLayout>
    );
  }

  if (analytics.isError || requestLog.isError || !analytics.data) {
    return (
      <AppLayout title="Request log" meta="backend unavailable">
        <PageErrorState title="Could not load request log" message="The backend API is unreachable. Confirm TokenWatch backend is running, then reload." />
      </AppLayout>
    );
  }

  return (
    <>
      <AppLayout title="Request log" meta={`${fmtNum(requestLog.data?.total ?? 0)} total requests`}>
        <div ref={topRef} />
        <div className="sticky top-0 z-20 -mx-4 mb-6 border-y border-hairline bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
                <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${streamStatusColor}`}>
                  <Radio className="h-3 w-3" />
                  {paused ? "paused" : streamStatus}
                </span>
                <span>{eventCount} events</span>
                <span>{lastTelemetryEventAt ? `latest ${fmtRelativeTime(lastTelemetryEventAt)}` : "waiting for telemetry"}</span>
                {requestLog.isFetching && <span>refreshing</span>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <SearchInput value={search} onChange={setSearch} placeholder="Search requests, routes, errors, metadata" className="w-full sm:w-80" />
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
                <GlobalFilters groups={filterGroups} values={filters} onChange={setFilter} onClear={clearFilters} />
                <ExportButton
                  rows={exportRows}
                  disabled={(requestLog.data?.total ?? 0) === 0}
                  filenamePrefix="requests"
                  exportPath="/api/requests/export"
                  queryParams={exportParams}
                />
              </div>
            </div>

            <div className="grid gap-3 border-t border-hairline pt-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  ["Latency min", minLatency, setMinLatency],
                  ["Latency max", maxLatency, setMaxLatency],
                  ["Cost min", minCost, setMinCost],
                  ["Cost max", maxCost, setMaxCost],
                  ["Tokens min", minTokens, setMinTokens],
                  ["Tokens max", maxTokens, setMaxTokens],
                ].map(([label, value, setter]) => (
                  <label key={label as string} className="grid gap-1 text-xs font-mono text-muted-foreground">
                    {label as string}
                    <input
                      inputMode="decimal"
                      value={value as string}
                      onChange={(event) => (setter as (next: string) => void)(event.target.value)}
                      className="h-9 border border-input bg-background px-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-foreground focus-visible:ring-0"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setPaused((value) => !value)} className="font-mono">
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {paused ? "Resume" : "Pause"}
                </Button>
                <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
                  Auto-scroll
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={() => topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })} className="font-mono">
                  <ArrowDownToLine className="h-4 w-4" />
                  Latest
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!hasActiveFilters} className="font-mono">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>

        <OperationalSummary items={summaryItems} />

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs font-mono text-muted-foreground">
            showing {from ? `${fmtNum(from)}-${fmtNum(to)}` : "0"} of {fmtNum(requestLog.data?.total ?? 0)}
            {hasActiveFilters ? " after filters" : ""}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>Per page</span>
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value) as (typeof PAGE_SIZES)[number])} className="input-rect w-24">
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <button className="link-underline text-sm disabled:opacity-40" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
              prev
            </button>
            <div className="label-mono">page {page} / {Math.max(1, totalPages)}</div>
            <button className="link-underline text-sm disabled:opacity-40" onClick={() => setPage((value) => value + 1)} disabled={!requestLog.data?.hasMore}>
              next
            </button>
          </div>
        </div>

        {requestLog.isFetching && rows.length > 0 && (
          <div className="mb-3 grid gap-2">
            <Skeleton className="h-1 w-full" />
          </div>
        )}

        {rows.length === 0 ? (
          currentWorkspace && !hasWorkspaceTelemetry ? (
            <SdkOnboarding workspace={currentWorkspace} compact />
          ) : (
            <div className="border-t border-hairline py-10 text-center text-sm text-muted-foreground">
              {hasActiveFilters ? "No requests match the current search and filters." : "No telemetry rows are available yet."}
            </div>
          )
        ) : (
          <DataTable
            sort={sort}
            onSortChange={setSort}
            columns={[
              { key: "timestamp", sortKey: "timestamp", sortable: true, label: "Timestamp", render: (row) => row.id < 0 ? <span className="font-mono text-xs">summary</span> : <span className="font-mono text-xs" title={new Date(row.timestamp).toISOString()}>{fmtRelativeTime(row.timestamp)}</span> },
              { key: "route", sortKey: "endpoint", sortable: true, label: "Endpoint", render: (row) => <Highlight value={row.route} query={debouncedSearch} className="font-mono" /> },
              { key: "model", sortKey: "model", sortable: true, label: "Model", render: (row) => <Highlight value={row.model} query={debouncedSearch} className="font-mono text-xs" /> },
              { key: "provider", sortKey: "provider", sortable: true, label: "Provider", render: (row) => <Highlight value={row.provider} query={debouncedSearch} className="label-mono" /> },
              { key: "total_tokens", sortKey: "tokens", sortable: true, label: "Tokens", align: "right", render: (row) => fmtCompactNum(row.total_tokens) },
              { key: "latency_ms", sortKey: "latency", sortable: true, label: "Latency", align: "right", render: (row) => fmtLatency(row.latency_ms) },
              { key: "cost_usd", sortKey: "cost", sortable: true, label: "Cost", align: "right", render: (row) => fmtUSD(row.cost_usd) },
              {
                key: "error",
                sortKey: "status",
                sortable: true,
                label: "Status",
                align: "right",
                render: (row) => <span className={`font-mono text-xs ${row.error ? "text-negative" : "text-positive"}`}>{getStatusLabel(row.error)}</span>,
              },
            ]}
            rows={rows}
            summaryRows={[{
              id: -1,
              workspace_id: "",
              timestamp: 0,
              route: "Page total",
              model: "",
              provider: "",
              input_tokens: 0,
              output_tokens: 0,
              total_tokens: pageSummary.totalTokens,
              cost_usd: pageSummary.totalCost,
              latency_ms: pageSummary.avgLatency,
              error: pageSummary.errors ? `${pageSummary.errors} errors` : null,
            }]}
            onRowClick={(row) => setSelectedRequest(row)}
            getRowKey={(row) => row.id}
            getRowClassName={(row) => newRowIds.has(row.id) ? "animate-in fade-in bg-secondary/70" : undefined}
          />
        )}

        <div className="mt-3 text-xs font-mono text-muted-foreground">
          {requestLog.data?.nextCursor && sort.key === "timestamp" && sort.direction === "desc" ? `next cursor ${requestLog.data.nextCursor}` : "end of current page"}
        </div>
      </AppLayout>

      <RequestDetailDrawer open={Boolean(selectedRequest)} request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </>
  );
}

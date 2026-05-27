import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { RequestDetailDrawer } from "@/components/RequestDetailDrawer";
import { SdkOnboarding } from "@/components/SdkOnboarding";
import { Checkbox } from "@/components/ui/checkbox";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAuth } from "@/contexts/AuthContext";
import { useStatus } from "@/contexts/StatusContext";
import {
  setRequestLogRefreshEnabled,
  type TelemetryRow,
  type TelemetryModel,
  type TelemetryProvider,
  type TelemetryRoute,
  useAnalyticsSnapshotQuery,
  useRequestLogQuery,
} from "@/lib/api";
import { fmtCompactNum, fmtLatency, fmtNum, fmtRelativeTime, fmtUSD } from "@/lib/data";

const PAGE_SIZES = [25, 50, 100] as const;

function getStatusLabel(error: string | null): string {
  if (!error) return "200";
  if (error.startsWith("HTTP_429")) return "429";
  if (error.startsWith("HTTP_500")) return "500";
  return "ERR";
}

export default function Requests() {
  const { currentWorkspace } = useAuth();
  const { streamStatus } = useStatus();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [endpoint, setEndpoint] = useState<TelemetryRoute | "all">("all");
  const [provider, setProvider] = useState<TelemetryProvider | "all">("all");
  const [selectedModels, setSelectedModels] = useState<TelemetryModel[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<TelemetryRow | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setRequestLogRefreshEnabled(!paused);
    return () => setRequestLogRefreshEnabled(true);
  }, [paused]);

  const requestLog = useRequestLogQuery(currentWorkspace?.id, {
    page,
    limit,
    route: endpoint,
    provider,
    model: selectedModels,
  });

  const rows = useMemo(() => requestLog.data?.data ?? [], [requestLog.data?.data]);
  const isInitialLoading = analytics.isLoading || (requestLog.isLoading && rows.length === 0);

  useEffect(() => {
    setPage(1);
  }, [endpoint, provider, selectedModels, limit, currentWorkspace?.id]);

  const routeOptions = useMemo(() => analytics.data?.dimensions.routes ?? [], [analytics.data?.dimensions.routes]);
  const modelOptions = useMemo(() => analytics.data?.dimensions.models ?? [], [analytics.data?.dimensions.models]);
  const providerOptions = useMemo(() => analytics.data?.dimensions.providers ?? [], [analytics.data?.dimensions.providers]);

  useEffect(() => {
    if (endpoint !== "all" && !routeOptions.includes(endpoint)) {
      setEndpoint("all");
    }
  }, [endpoint, routeOptions]);

  useEffect(() => {
    if (provider !== "all" && !providerOptions.includes(provider)) {
      setProvider("all");
    }
  }, [provider, providerOptions]);

  useEffect(() => {
    setSelectedModels((current) => current.filter((model) => modelOptions.includes(model)));
  }, [modelOptions]);

  useEffect(() => {
    if (!selectedRequest) return;
    const updated = rows.find((row) => row.id === selectedRequest.id);
    if (updated) {
      setSelectedRequest(updated);
    }
  }, [rows, selectedRequest]);

  const totalPages = requestLog.data ? Math.max(1, Math.ceil(requestLog.data.total / requestLog.data.limit)) : 1;
  const from = requestLog.data ? (requestLog.data.total === 0 ? 0 : (requestLog.data.page - 1) * requestLog.data.limit + 1) : 0;
  const to = requestLog.data ? Math.min(requestLog.data.page * requestLog.data.limit, requestLog.data.total) : 0;

  const modelCounts = useMemo(() => {
    const counts = new Map<TelemetryModel, number>();
    for (const row of analytics.data?.models ?? []) {
      counts.set(row.model, row.requests);
    }
    return counts;
  }, [analytics.data?.models]);

  const selectedModelLabel = selectedModels.length === 0 ? "all models" : `${selectedModels.length} selected`;
  const hasWorkspaceTelemetry = routeOptions.length > 0 || modelOptions.length > 0 || providerOptions.length > 0;

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
        <p className="text-sm text-muted-foreground max-w-2xl mb-6">
          Live telemetry rows from the workspace request table. Filters are workspace-scoped, and pagination stays stable while realtime events arrive.
        </p>

        <div className="flex flex-col gap-4 hairline pb-5 mb-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-5">
            <label className="flex flex-col gap-1.5 text-xs font-mono text-muted-foreground">
              <span>Endpoint</span>
              <select value={endpoint} onChange={(event) => setEndpoint(event.target.value as TelemetryRoute | "all")} className="input-rect w-56">
                <option value="all">all endpoints</option>
                {routeOptions.map((route) => (
                  <option key={route} value={route}>
                    {route === "all" ? "— all endpoints —" : route}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-mono text-muted-foreground">
              <span>Provider</span>
              <select value={provider} onChange={(event) => setProvider(event.target.value as TelemetryProvider | "all")} className="input-rect w-44">
                <option value="all">all providers</option>
                {providerOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1.5 text-xs font-mono text-muted-foreground">
              <span>Models</span>
              <div className="flex flex-wrap gap-2 rounded border border-hairline bg-background p-2">
                {modelOptions.map((model) => {
                  const checked = selectedModels.includes(model);
                  return (
                    <label key={model} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-foreground hover:bg-secondary/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelectedModels((current) => {
                            const next = value ? [...current, model] : current.filter((item) => item !== model);
                            return Array.from(new Set(next));
                          });
                        }}
                      />
                      <span className="font-mono">{model}</span>
                      <span className="text-muted-foreground">({fmtNum(modelCounts.get(model) ?? 0)})</span>
                    </label>
                  );
                })}
                <button
                  type="button"
                  className="ml-1 text-xs link-underline"
                  onClick={() => setSelectedModels([])}
                >
                  all models
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEndpoint("all");
                setProvider("all");
                setSelectedModels([]);
                setPage(1);
              }}
              className="text-sm link-underline pb-2"
            >
              reset filters
            </button>
          </div>

          <div className="flex items-center gap-4 pb-2 text-xs font-mono text-muted-foreground">
            <span>{paused ? "paused" : streamStatus}</span>
            <button type="button" className="link-underline" onClick={() => setPaused((value) => !value)}>
              {paused ? "resume live" : "pause live"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs font-mono text-muted-foreground">
            showing {from ? `${fmtNum(from)}–${fmtNum(to)}` : "0"} of {fmtNum(requestLog.data?.total ?? 0)} · {selectedModelLabel}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>Per page</span>
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value) as (typeof PAGE_SIZES)[number])} className="input-rect w-24">
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <button className="link-underline text-sm disabled:opacity-40" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
              prev
            </button>
            <div className="label-mono">page {page} / {Math.max(1, totalPages)}</div>
            <button
              className="link-underline text-sm disabled:opacity-40"
              onClick={() => setPage((value) => value + 1)}
              disabled={!requestLog.data?.hasMore}
            >
              next
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          currentWorkspace && !hasWorkspaceTelemetry ? (
            <SdkOnboarding workspace={currentWorkspace} compact />
          ) : (
            <div className="border-t border-hairline py-8 text-center text-sm text-muted-foreground">
              No telemetry rows match the current filters — try clearing filters or verify your SDK is sending events.
            </div>
          )
        ) : (
          <DataTable
            columns={[
              { key: "timestamp", label: "Timestamp", render: (row) => <span className="font-mono text-xs">{fmtRelativeTime(row.timestamp)}</span> },
              { key: "route", label: "Endpoint", render: (row) => <span className="font-mono">{row.route}</span> },
              { key: "model", label: "Model", render: (row) => <span className="font-mono text-xs">{row.model}</span> },
              { key: "provider", label: "Provider", render: (row) => <span className="label-mono">{row.provider}</span> },
              { key: "input_tokens", label: "In", align: "right", render: (row) => fmtCompactNum(row.input_tokens) },
              { key: "output_tokens", label: "Out", align: "right", render: (row) => fmtCompactNum(row.output_tokens) },
              { key: "latency_ms", label: "Latency", align: "right", render: (row) => fmtLatency(row.latency_ms) },
              { key: "cost_usd", label: "Cost", align: "right", render: (row) => fmtUSD(row.cost_usd) },
              {
                key: "error",
                label: "Status",
                align: "right",
                render: (row) => <span className={`font-mono text-xs ${row.error ? "text-negative" : "text-positive"}`}>{getStatusLabel(row.error)}</span>,
              },
            ]}
            rows={rows}
            onRowClick={(row) => setSelectedRequest(row)}
            getRowKey={(row) => row.id}
          />
        )}

        <div className="mt-3 text-xs font-mono text-muted-foreground">
          {requestLog.isFetching ? "refreshing live feed…" : requestLog.data?.nextCursor ? `next cursor ${requestLog.data.nextCursor}` : "end of page"}
        </div>
      </AppLayout>

      <RequestDetailDrawer open={Boolean(selectedRequest)} request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Drawer from "@/components/Drawer";
import { DataTable } from "@/components/DataTable";
import { Checkbox } from "@/components/ui/checkbox";
import { WarmupPlaceholder } from "@/components/WarmupPlaceholder";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAuth } from "@/contexts/AuthContext";
import { useStatus } from "@/contexts/StatusContext";
import {
  setRequestLogRefreshEnabled,
  type TelemetryModel,
  type TelemetryRoute,
  useAnalyticsSnapshotQuery,
  useRequestLogQuery,
} from "@/lib/api";
import { fmtCompactNum, fmtLatency, fmtNum, fmtRelativeTime, fmtUSD } from "@/lib/data";

const PAGE_SIZES = [25, 50, 100] as const;
const MODEL_OPTIONS: TelemetryModel[] = ["gpt-4o", "gpt-4o-mini", "claude-sonnet", "claude-haiku"];
const ROUTE_OPTIONS: Array<TelemetryRoute | "all"> = ["all", "/api/chat", "/api/search", "/api/summarize", "/api/autocomplete", "/api/agents"];

function getStatusLabel(error: string | null): string {
  if (!error) return "200";
  if (error.startsWith("HTTP_429")) return "429";
  if (error.startsWith("HTTP_500")) return "500";
  return "ERR";
}

export default function Requests() {
  const { currentWorkspace } = useAuth();
  const { simulatorStatus, streamStatus } = useStatus();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [endpoint, setEndpoint] = useState<TelemetryRoute | "all">("all");
  const [selectedModels, setSelectedModels] = useState<TelemetryModel[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setRequestLogRefreshEnabled(!paused);
    return () => setRequestLogRefreshEnabled(true);
  }, [paused]);

  const requestLog = useRequestLogQuery(currentWorkspace?.id, {
    page,
    limit,
    route: endpoint,
    model: selectedModels,
  });

  const rows = useMemo(() => requestLog.data?.data ?? [], [requestLog.data?.data]);
  const isWarmup = simulatorStatus === "warming up" || simulatorStatus === "starting";
  const isInitialLoading = analytics.isLoading || (requestLog.isLoading && rows.length === 0);

  useEffect(() => {
    setPage(1);
  }, [endpoint, selectedModels, limit, currentWorkspace?.id]);

  useEffect(() => {
    if (!selectedRequestId) return;
    if (!rows.some((row) => row.id === selectedRequestId)) {
      setSelectedRequestId(null);
    }
  }, [rows, selectedRequestId]);

  const selectedRequest = selectedRequestId ? rows.find((row) => row.id === selectedRequestId) ?? null : null;
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

  if (isInitialLoading) {
    return (
      <AppLayout title="Request log" meta={isWarmup ? "bootstrapping telemetry…" : "loading telemetry…"}>
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
                {ROUTE_OPTIONS.map((route) => (
                  <option key={route} value={route}>
                    {route === "all" ? "— all endpoints —" : route}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1.5 text-xs font-mono text-muted-foreground">
              <span>Models</span>
              <div className="flex flex-wrap gap-2 rounded border border-hairline bg-background p-2">
                {MODEL_OPTIONS.map((model) => {
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
          isWarmup ? (
            <WarmupPlaceholder title="warming up stream" description="waiting for request traffic to settle into the log" bootstrappingPercent={analytics.data.overview.requestsToday > 0 ? 100 : 22} />
          ) : (
            <div className="border-t border-hairline py-8 text-center text-sm text-muted-foreground">
              waiting for requests
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
            onRowClick={(row) => setSelectedRequestId(row.id)}
            getRowKey={(row) => row.id}
          />
        )}

        <div className="mt-3 text-xs font-mono text-muted-foreground">
          {requestLog.isFetching ? "refreshing live feed…" : requestLog.data?.nextCursor ? `next cursor ${requestLog.data.nextCursor}` : "end of page"}
        </div>
      </AppLayout>

      <Drawer open={Boolean(selectedRequest)} onClose={() => setSelectedRequestId(null)} title={selectedRequest ? `${selectedRequest.route} · request #${selectedRequest.id}` : undefined}>
        {selectedRequest && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="label-mono mb-2">Timestamp</div>
                <div className="font-mono text-sm">{new Date(selectedRequest.timestamp).toLocaleString()}</div>
              </div>
              <div>
                <div className="label-mono mb-2">Provider</div>
                <div className="font-mono text-sm">{selectedRequest.provider}</div>
              </div>
              <div>
                <div className="label-mono mb-2">Latency</div>
                <div className="font-mono text-sm">{fmtLatency(selectedRequest.latency_ms)}</div>
              </div>
              <div>
                <div className="label-mono mb-2">Cost</div>
                <div className="font-mono text-sm">{fmtUSD(selectedRequest.cost_usd)}</div>
              </div>
            </div>

            <section className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="label-mono mb-2">Request metadata</h3>
                <div className="border-t border-hairline pt-3 space-y-2 text-sm font-mono">
                  <div>Workspace: {selectedRequest.workspace_id}</div>
                  <div>Endpoint: {selectedRequest.route}</div>
                  <div>Model: {selectedRequest.model}</div>
                  <div>Provider: {selectedRequest.provider}</div>
                  <div>Status: {getStatusLabel(selectedRequest.error)}</div>
                </div>
              </div>
              <div>
                <h3 className="label-mono mb-2">Tokens</h3>
                <div className="border-t border-hairline pt-3 space-y-2 text-sm font-mono">
                  <div>Input: {fmtNum(selectedRequest.input_tokens)}</div>
                  <div>Output: {fmtNum(selectedRequest.output_tokens)}</div>
                  <div>Total: {fmtNum(selectedRequest.total_tokens)}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="label-mono mb-2">Error details</h3>
              <div className="border-t border-hairline pt-3 text-sm">
                {selectedRequest.error ? <div className="font-mono text-negative">{selectedRequest.error}</div> : <div className="text-muted-foreground">No error recorded</div>}
              </div>
            </section>

            <section>
              <h3 className="label-mono mb-2">Raw telemetry payload preview</h3>
              <pre className="border-t border-hairline pt-3 overflow-auto bg-secondary/20 p-3 text-xs font-mono leading-6 whitespace-pre-wrap">
{JSON.stringify(selectedRequest, null, 2)}
              </pre>
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}

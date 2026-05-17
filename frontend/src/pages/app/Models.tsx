import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Drawer from "@/components/Drawer";
import { DataTable } from "@/components/DataTable";
import { WarmupPlaceholder } from "@/components/WarmupPlaceholder";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useStatus } from "@/contexts/StatusContext";
import {
  type AnalyticsModelRow,
  type TelemetryRow,
  useAnalyticsSnapshotQuery,
  useTelemetryRowsQuery,
} from "@/lib/api";
import { fmtCompactNum, fmtLatency, fmtNum, fmtUSD } from "@/lib/data";

type SortKey = "cost" | "requests" | "tokens" | "latency";
type ProviderFilter = "all" | AnalyticsModelRow["provider"];
type ModelKey = `${AnalyticsModelRow["model"]}::${AnalyticsModelRow["provider"]}`;

const SORT_LABELS: Record<SortKey, string> = {
  cost: "Total cost",
  requests: "Requests",
  tokens: "Tokens",
  latency: "Avg latency",
};

const PROVIDER_LABELS: Record<AnalyticsModelRow["provider"], string> = {
  OpenAI: "OpenAI",
  Anthropic: "Anthropic",
  Google: "Google",
};

const PROVIDER_BADGES: Record<AnalyticsModelRow["provider"], string> = {
  OpenAI: "border-cyan-500/20 bg-cyan-500/5 text-cyan-700",
  Anthropic: "border-violet-500/20 bg-violet-500/5 text-violet-700",
  Google: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700",
};

function getModelKey(row: Pick<AnalyticsModelRow, "model" | "provider">): ModelKey {
  return `${row.model}::${row.provider}`;
}

function isErrorRow(row: TelemetryRow): boolean {
  return Boolean(row.error);
}

function getProviderLabel(provider: AnalyticsModelRow["provider"]): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function getProviderBadgeClass(provider: AnalyticsModelRow["provider"]): string {
  return PROVIDER_BADGES[provider] ?? "border-hairline bg-secondary/40 text-muted-foreground";
}

export default function Models() {
  const { currentWorkspace } = useAuth();
  const { simulatorStatus } = useStatus();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const telemetry = useTelemetryRowsQuery(currentWorkspace?.id);
  const [selectedKey, setSelectedKey] = useState<ModelKey | null>(null);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("cost");

  const rows = useMemo(() => analytics.data?.models ?? [], [analytics.data?.models]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = rows.filter((row) => {
      const matchesProvider = providerFilter === "all" || row.provider === providerFilter;
      const matchesSearch =
        !query ||
        row.model.toLowerCase().includes(query) ||
        row.provider.toLowerCase().includes(query);

      return matchesProvider && matchesSearch;
    });

    return [...result].sort((left, right) => {
      const leftValue =
        sortKey === "cost"
          ? left.cost_usd
          : sortKey === "requests"
            ? left.requests
            : sortKey === "tokens"
              ? left.tokens
              : left.avg_latency_ms;
      const rightValue =
        sortKey === "cost"
          ? right.cost_usd
          : sortKey === "requests"
            ? right.requests
            : sortKey === "tokens"
              ? right.tokens
              : right.avg_latency_ms;

      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      const modelCompare = left.model.localeCompare(right.model);
      if (modelCompare !== 0) {
        return modelCompare;
      }

      return left.provider.localeCompare(right.provider);
    });
  }, [providerFilter, rows, search, sortKey]);

  useEffect(() => {
    if (!selectedKey) {
      return;
    }

    const stillVisible = rows.some((row) => getModelKey(row) === selectedKey);
    if (!stillVisible) {
      setSelectedKey(null);
    }
  }, [rows, selectedKey]);

  const selectedRow = selectedKey ? rows.find((row) => getModelKey(row) === selectedKey) ?? null : null;

  const modelRows = useMemo(() => {
    const visible = selectedRow
      ? (telemetry.data ?? []).filter((row) => row.model === selectedRow.model && row.provider === selectedRow.provider)
      : [];

    return visible.sort((left, right) => right.timestamp - left.timestamp || right.id - left.id);
  }, [selectedRow, telemetry.data]);

  const detail = useMemo(() => {
    if (!selectedRow) {
      return null;
    }

    const endpointBreakdown = new Map<string, { route: string; requests: number; cost: number; tokens: number; latency: number }>();
    const recentErrors: TelemetryRow[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;

    for (const row of modelRows) {
      inputTokens += row.input_tokens ?? 0;
      outputTokens += row.output_tokens ?? 0;
      totalTokens += row.total_tokens ?? row.input_tokens + row.output_tokens;
      totalCost += row.cost_usd ?? 0;
      totalLatency += row.latency_ms ?? 0;

      const endpointKey = row.route;
      const existing = endpointBreakdown.get(endpointKey) ?? {
        route: endpointKey,
        requests: 0,
        cost: 0,
        tokens: 0,
        latency: 0,
      };

      existing.requests += 1;
      existing.cost += row.cost_usd ?? 0;
      existing.tokens += row.total_tokens ?? row.input_tokens + row.output_tokens;
      existing.latency += row.latency_ms ?? 0;
      endpointBreakdown.set(endpointKey, existing);

      if (isErrorRow(row)) {
        recentErrors.push(row);
      }
    }

    const endpoints = [...endpointBreakdown.values()].sort((left, right) => right.cost - left.cost || left.route.localeCompare(right.route));
    const requestCount = modelRows.length;

    return {
      requestCount,
      inputTokens,
      outputTokens,
      totalTokens,
      totalCost,
      avgLatency: requestCount > 0 ? totalLatency / requestCount : 0,
      endpoints,
      recentErrors: recentErrors.slice(0, 8),
      recentActivity: modelRows.slice(0, 8),
    };
  }, [modelRows, selectedRow]);

  const isWarmup = simulatorStatus?.status === "warming up" || simulatorStatus?.status === "starting";

  if (analytics.isLoading || telemetry.isLoading) {
    return (
      <AppLayout title="Models" meta="loading analytics…">
        <PageLoadingState rows={5} />
      </AppLayout>
    );
  }

  if (analytics.isError || telemetry.isError || !analytics.data) {
    return (
      <AppLayout title="Models" meta="backend unavailable">
        <PageErrorState
          title="Could not load models"
          message="The analytics API is unavailable. Start the backend and reload the dashboard."
        />
      </AppLayout>
    );
  }

  const hasRows = filteredRows.length > 0;
  const totalTokens = filteredRows.reduce((sum, row) => sum + row.tokens, 0);
  const totalCost = filteredRows.reduce((sum, row) => sum + row.cost_usd, 0);

  return (
    <>
      <AppLayout title="Models" meta={`${filteredRows.length} models tracked`}>
        <p className="text-sm text-muted-foreground max-w-2xl mb-6">
          Aggregated from live telemetry rows only. Cost is sorted by default, and updates flow through the shared realtime snapshot.
        </p>

        <div className="mb-6 flex flex-col gap-3 border-t border-hairline pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>Filter</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="model or provider"
                className="h-8 w-44 rounded border border-hairline bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>Provider</span>
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)}
                className="h-8 rounded border border-hairline bg-background px-2 text-sm outline-none"
              >
                <option value="all">All</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="Google">Google</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>Sort</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-8 rounded border border-hairline bg-background px-2 text-sm outline-none"
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-8 hairline pb-8 sm:grid-cols-3">
          <div>
            <div className="label-mono mb-2">Requests</div>
            <div className="font-serif text-3xl num">{fmtNum(filteredRows.reduce((sum, row) => sum + row.requests, 0))}</div>
          </div>
          <div>
            <div className="label-mono mb-2">Total tokens</div>
            <div className="font-serif text-3xl num">{fmtCompactNum(totalTokens)}</div>
          </div>
          <div>
            <div className="label-mono mb-2">Total cost</div>
            <div className="font-serif text-3xl num">{fmtUSD(totalCost)}</div>
          </div>
        </div>

        {!hasRows ? (
          isWarmup ? (
            <div className="mt-8">
              <WarmupPlaceholder
                title="warming up telemetry"
                description="waiting for model traffic to arrive and stabilize"
                bootstrappingPercent={analytics.data.overview.requestsToday > 0 ? 100 : 28}
              />
            </div>
          ) : (
            <div className="mt-8 border-t border-hairline py-8 text-center text-sm text-muted-foreground">
              waiting for model traffic
            </div>
          )
        ) : (
          <DataTable
            columns={[
              {
                key: "model",
                label: "Model",
                render: (row) => (
                  <div className="space-y-1">
                    <div className="font-mono text-sm">{row.model}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`rounded-sm px-2 py-0 text-[10px] uppercase tracking-[0.2em] ${getProviderBadgeClass(row.provider)}`}>
                        {getProviderLabel(row.provider)}
                      </Badge>
                    </div>
                  </div>
                ),
              },
              {
                key: "requests",
                label: "Requests",
                align: "right",
                render: (row) => <span className="num">{fmtNum(row.requests)}</span>,
              },
              {
                key: "tokens",
                label: "Tokens",
                align: "right",
                render: (row) => (
                  <div className="space-y-0.5 text-right">
                    <div className="num">{fmtCompactNum(row.tokens)}</div>
                    <div className="label-mono text-[10px] text-muted-foreground">
                      in {fmtCompactNum(row.input_tokens)} · out {fmtCompactNum(row.output_tokens)}
                    </div>
                  </div>
                ),
              },
              {
                key: "avg_latency_ms",
                label: "Avg latency",
                align: "right",
                render: (row) => <span className="num">{fmtLatency(row.avg_latency_ms)}</span>,
              },
              {
                key: "cost_usd",
                label: "Cost",
                align: "right",
                render: (row) => <span className="num">{fmtUSD(row.cost_usd)}</span>,
              },
            ]}
            rows={filteredRows}
            onRowClick={(row) => setSelectedKey(getModelKey(row))}
            getRowKey={(row) => getModelKey(row)}
          />
        )}
      </AppLayout>

      <Drawer open={Boolean(selectedRow)} onClose={() => setSelectedKey(null)} title={selectedRow ? `${selectedRow.model} · ${getProviderLabel(selectedRow.provider)}` : undefined}>
        {selectedRow && detail && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="label-mono mb-2">Requests</div>
                <div className="font-serif text-3xl num">{fmtNum(detail.requestCount)}</div>
              </div>
              <div>
                <div className="label-mono mb-2">Total tokens</div>
                <div className="font-serif text-3xl num">{fmtCompactNum(detail.totalTokens)}</div>
              </div>
              <div>
                <div className="label-mono mb-2">Total cost</div>
                <div className="font-serif text-3xl num">{fmtUSD(detail.totalCost)}</div>
              </div>
              <div>
                <div className="label-mono mb-2">Avg latency</div>
                <div className="font-serif text-3xl num">{fmtLatency(detail.avgLatency)}</div>
              </div>
            </div>

            <section>
              <h3 className="label-mono mb-2">Token split</h3>
              <div className="grid grid-cols-3 gap-3 border-t border-hairline pt-3">
                <div>
                  <div className="label-mono mb-1">Input</div>
                  <div className="font-mono text-lg">{fmtCompactNum(detail.inputTokens)}</div>
                </div>
                <div>
                  <div className="label-mono mb-1">Output</div>
                  <div className="font-mono text-lg">{fmtCompactNum(detail.outputTokens)}</div>
                </div>
                <div>
                  <div className="label-mono mb-1">Total</div>
                  <div className="font-mono text-lg">{fmtCompactNum(detail.totalTokens)}</div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="label-mono">Endpoint usage</h3>
                <div className="label-mono">{detail.endpoints.length} routes</div>
              </div>
              <div className="border-t border-hairline">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-hairline text-xs font-mono text-muted-foreground">
                      <th className="py-2 text-left">Route</th>
                      <th className="py-2 text-right">Requests</th>
                      <th className="py-2 text-right">Tokens</th>
                      <th className="py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.endpoints.map((endpoint) => (
                      <tr key={endpoint.route} className="border-b border-hairline/60">
                        <td className="py-2 font-mono text-sm">{endpoint.route}</td>
                        <td className="py-2 text-right num">{fmtNum(endpoint.requests)}</td>
                        <td className="py-2 text-right num">{fmtCompactNum(endpoint.tokens)}</td>
                        <td className="py-2 text-right num">{fmtUSD(endpoint.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="label-mono">Recent activity</h3>
                  <div className="label-mono">last 8</div>
                </div>
                {detail.recentActivity.length > 0 ? (
                  <div className="border-t border-hairline">
                    {detail.recentActivity.map((row) => (
                      <div key={row.id} className="border-b border-hairline/60 py-2 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <div className="font-mono text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</div>
                          <div className={`font-mono ${row.error ? "text-negative" : "text-muted-foreground"}`}>{row.error ? row.error : "200"}</div>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-4">
                          <div className="font-mono">{row.route}</div>
                          <div className="font-mono text-muted-foreground">{fmtUSD(row.cost_usd)} · {fmtCompactNum(row.total_tokens)} tok</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-t border-hairline py-4 text-sm text-muted-foreground">No recent activity</div>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="label-mono">Recent errors</h3>
                  <div className="label-mono">latest 8</div>
                </div>
                {detail.recentErrors.length > 0 ? (
                  <div className="border-t border-hairline">
                    {detail.recentErrors.map((row) => (
                      <div key={row.id} className="border-b border-hairline/60 py-2 text-xs text-negative">
                        <div className="font-mono text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</div>
                        <div className="mt-1 font-mono">{row.route} · {row.error}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-t border-hairline py-4 text-sm text-muted-foreground">No recent errors</div>
                )}
              </div>
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
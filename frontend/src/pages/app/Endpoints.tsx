import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import Drawer from "@/components/Drawer";
import { fmtUSD, fmtNum } from "@/lib/data";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAnalyticsSnapshotQuery, useTelemetryRowsQuery } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function Endpoints() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const { currentWorkspace } = useAuth();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const telemetry = useTelemetryRowsQuery(currentWorkspace?.id);

  if (analytics.isLoading || telemetry.isLoading) {
    return (
      <AppLayout title="Endpoints" meta="loading analytics…">
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

  const sorted = [...analytics.data.endpoints].sort((a, b) => b.cost_usd - a.cost_usd);
  const historyRows = telemetry.data ?? [];

  const selected = selectedRoute ? sorted.find((row) => row.route === selectedRoute) ?? null : null;

  if (selected) {
    const history = historyRows.filter((l) => l.route === selected.route);
    const buckets = Array.from({ length: 24 }, () => 0);
    const now = Date.now();

    for (const row of history) {
      const bucketIndex = Math.max(0, Math.min(23, 23 - Math.floor((now - (row.timestamp ?? 0)) / (60 * 60 * 1000))));
      buckets[bucketIndex] += row.cost_usd ?? 0;
    }

    return (
      <>
        <AppLayout title="Endpoints" meta={`${sorted.length} endpoints tracked`}>
          <p className="text-sm text-muted-foreground max-w-2xl mb-8">
            Routes are derived from the <span className="font-mono text-foreground">endpoint</span> tag passed to <span className="font-mono text-foreground">track()</span>.
            Click any row for request history, cost trend, and model breakdown.
          </p>
          <DataTable
            columns={[
              { key: "route", label: "Endpoint", render: (r) => <span className="font-mono">{r.route}</span> },
              { key: "requests", label: "Requests", align: "right", render: (r) => fmtNum(r.requests) },
              { key: "cost_usd", label: "Total cost", align: "right", render: (r) => fmtUSD(r.cost_usd) },
              { key: "avg_cost_usd", label: "Avg / req", align: "right", render: (r) => <span className="text-muted-foreground">{fmtUSD(r.avg_cost_usd)}</span> },
              { key: "avg_latency_ms", label: "Avg latency", align: "right", render: (r) => `${Math.round(r.avg_latency_ms)} ms` },
            ]}
            rows={sorted}
            onRowClick={(r) => setSelectedRoute(r.route)}
          />
        </AppLayout>

        <Drawer open={!!selected} onClose={() => setSelectedRoute(null)} title={selected.route}>
          <div className="grid grid-cols-4 gap-10 hairline pb-8">
            <div>
              <div className="label-mono mb-2">Requests · 24h</div>
              <div className="font-serif text-3xl num">{fmtNum(selected.requests)}</div>
            </div>
            <div>
              <div className="label-mono mb-2">Total cost</div>
              <div className="font-serif text-3xl num">{fmtUSD(selected.cost_usd)}</div>
            </div>
            <div>
              <div className="label-mono mb-2">Avg cost</div>
              <div className="font-serif text-3xl num">{fmtUSD(selected.avg_cost_usd)}</div>
            </div>
            <div>
              <div className="label-mono mb-2">Avg latency</div>
              <div className="font-serif text-3xl num">{Math.round(selected.avg_latency_ms)}<span className="text-base text-muted-foreground ml-1">ms</span></div>
            </div>
          </div>

          {history.length > 0 && (
            <section className="mt-6">
              <h3 className="label-mono mb-2">Model usage</h3>
              <div className="border-t border-b border-hairline py-3">
                <table className="w-full">
                  <thead>
                    <tr className="label-mono text-sm text-muted-foreground">
                      <th className="text-left py-1">Model</th>
                      <th className="text-right py-1">Requests</th>
                      <th className="text-right py-1">Tokens</th>
                      <th className="text-right py-1">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      history.reduce<Record<string, { requests: number; tokens: number; cost: number }>>((acc, r) => {
                        const key = `${r.model}::${r.provider}`;
                        acc[key] = acc[key] || { requests: 0, tokens: 0, cost: 0 };
                        acc[key].requests += 1;
                        acc[key].tokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
                        acc[key].cost += r.cost_usd ?? 0;
                        return acc;
                      }, {})
                    ).map(([k, v]) => ({ key: k, model: k.split("::")[0], provider: k.split("::")[1], ...v }))
                      .sort((a, b) => b.cost - a.cost)
                      .map((m) => (
                        <tr key={m.key} className="border-b border-hairline/60">
                          <td className="py-2"><span className="font-mono text-sm">{m.model}</span><div className="text-xs text-muted-foreground">{m.provider}</div></td>
                          <td className="py-2 text-right">{fmtNum(m.requests)}</td>
                          <td className="py-2 text-right">{fmtNum(m.tokens)}</td>
                          <td className="py-2 text-right">{fmtUSD(m.cost)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-serif text-md mb-2">Recent errors</h3>
              {history.filter((r) => r.error).length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent errors</div>
              ) : (
                <ul className="text-sm font-mono">
                  {history.filter((r) => r.error).slice(0, 8).map((r, i) => (
                    <li key={i} className="text-negative">{new Date(r.timestamp).toLocaleString()} · {r.error}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="font-serif text-md mb-2">Token totals (recent)</h3>
              <div className="label-mono">In: <span className="font-mono">{fmtNum(history.reduce((s, r) => s + (r.input_tokens ?? 0), 0))}</span></div>
              <div className="label-mono">Out: <span className="font-mono">{fmtNum(history.reduce((s, r) => s + (r.output_tokens ?? 0), 0))}</span></div>
              <div className="label-mono mt-2">Total: <span className="font-mono">{fmtNum(history.reduce((s, r) => s + ((r.input_tokens ?? 0) + (r.output_tokens ?? 0)), 0))}</span></div>
            </div>
          </section>

          <section className="mt-12">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-serif text-xl">Cost trend · 24h</h2>
              <div className="label-mono">hourly</div>
            </div>
            <div className="border-t border-b border-hairline py-6">
              <div className="flex items-end gap-1 h-24">
                {buckets.map((cost, i) => {
                  const h = Math.max(10, Math.min(100, (cost / Math.max(selected.cost_usd ?? 0.000001, 0.000001)) * 100));
                  return <div key={i} className="flex-1 bg-foreground/80" style={{ height: `${h}%` }} />;
                })}
              </div>
              <div className="flex justify-between label-mono mt-2"><span>00:00</span><span>12:00</span><span>23:59</span></div>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-xl mb-3">Request history</h2>
            <DataTable
              columns={[
                {key: "timestamp", label: "Timestamp", render: (r) => <span className="font-mono text-xs">{new Date(r.timestamp).toLocaleString()}</span> },
                { key: "model", label: "Model", render: (r) => <span className="font-mono">{r.model}</span> },
                { key: "input_tokens", label: "In", align: "right", render: (r) => fmtNum(r.input_tokens) },
                { key: "output_tokens", label: "Out", align: "right", render: (r) => fmtNum(r.output_tokens) },
                { key: "cost_usd", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost_usd) },
                { key: "error", label: "Status", align: "right", render: (r) => <span className={`font-mono text-xs ${!r.error ? "" : "text-negative"}`}>{!r.error ? "200" : r.error.startsWith("HTTP_429") ? "429" : "500"}</span> },
              ]}
              rows={history}
            />
          </section>

        </Drawer>
      </>
    );
  }

  return (
    <AppLayout title="Endpoints" meta={`${sorted.length} endpoints tracked`}>
      <p className="text-sm text-muted-foreground max-w-2xl mb-8">
        Routes are derived from the <span className="font-mono text-foreground">endpoint</span> tag passed to <span className="font-mono text-foreground">track()</span>.
        Click any row for request history, cost trend, and model breakdown.
      </p>
      <DataTable
        columns={[
          { key: "route", label: "Endpoint", render: (r) => <span className="font-mono">{r.route}</span> },
          { key: "requests", label: "Requests", align: "right", render: (r) => fmtNum(r.requests) },
          { key: "cost_usd", label: "Total cost", align: "right", render: (r) => fmtUSD(r.cost_usd) },
          { key: "avg_cost_usd", label: "Avg / req", align: "right", render: (r) => <span className="text-muted-foreground">{fmtUSD(r.avg_cost_usd)}</span> },
          { key: "avg_latency_ms", label: "Avg latency", align: "right", render: (r) => `${Math.round(r.avg_latency_ms)} ms` },
        ]}
        rows={sorted}
        onRowClick={(r) => setSelectedRoute(r.route)}
      />
    </AppLayout>
  );
}

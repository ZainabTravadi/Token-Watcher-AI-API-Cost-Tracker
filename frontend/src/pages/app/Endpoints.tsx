import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { fmtUSD, fmtNum } from "@/lib/data";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAnalyticsSnapshotQuery, useTelemetryRowsQuery } from "@/lib/api";

export default function Endpoints() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const analytics = useAnalyticsSnapshotQuery();
  const telemetry = useTelemetryRowsQuery();

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
  const selected = selectedRoute ? sorted.find((row) => row.route === selectedRoute) ?? null : null;
  const historyRows = telemetry.data ?? [];

  if (selected) {
    const history = historyRows.filter((l) => l.route === selected.route);
    const buckets = Array.from({ length: 24 }, () => 0);
    const now = Date.now();

    for (const row of history) {
      const bucketIndex = Math.max(0, Math.min(23, 23 - Math.floor((now - row.timestamp) / (60 * 60 * 1000))));
      buckets[bucketIndex] += row.cost_usd;
    }

    return (
      <AppLayout title={selected.route} meta={<button onClick={() => setSelectedRoute(null)} className="link-underline">← all endpoints</button>}>
        <div className="grid grid-cols-4 gap-10 hairline pb-8">
          <div><div className="label-mono mb-2">Requests · 24h</div><div className="font-serif text-3xl num">{fmtNum(selected.requests)}</div></div>
          <div><div className="label-mono mb-2">Total cost</div><div className="font-serif text-3xl num">{fmtUSD(selected.cost_usd)}</div></div>
          <div><div className="label-mono mb-2">Avg cost</div><div className="font-serif text-3xl num">{fmtUSD(selected.avg_cost_usd)}</div></div>
          <div><div className="label-mono mb-2">Avg latency</div><div className="font-serif text-3xl num">{Math.round(selected.avg_latency_ms)}<span className="text-base text-muted-foreground ml-1">ms</span></div></div>
        </div>

        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl">Cost trend · 24h</h2>
            <div className="label-mono">hourly</div>
          </div>
          <div className="border-t border-b border-hairline py-6">
            <div className="flex items-end gap-1 h-24">
              {buckets.map((cost, i) => {
                const h = Math.max(10, Math.min(100, (cost / Math.max(selected.cost_usd, 0.000001)) * 100));
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
      </AppLayout>
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

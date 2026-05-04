import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { endpoints, logs, fmtUSD, fmtNum, EndpointRow } from "@/lib/data";

export default function Endpoints() {
  const [selected, setSelected] = useState<EndpointRow | null>(null);
  const sorted = [...endpoints].sort((a, b) => b.cost - a.cost);

  if (selected) {
    const history = logs.filter((l) => l.endpoint === selected.path);
    return (
      <AppLayout title={selected.path} meta={<button onClick={() => setSelected(null)} className="link-underline">← all endpoints</button>}>
        <div className="grid grid-cols-4 gap-10 hairline pb-8">
          <div><div className="label-mono mb-2">Requests · 24h</div><div className="font-serif text-3xl num">{fmtNum(selected.requests)}</div></div>
          <div><div className="label-mono mb-2">Total cost</div><div className="font-serif text-3xl num">{fmtUSD(selected.cost)}</div></div>
          <div><div className="label-mono mb-2">Avg cost</div><div className="font-serif text-3xl num">{fmtUSD(selected.avgCost)}</div></div>
          <div><div className="label-mono mb-2">Avg latency</div><div className="font-serif text-3xl num">{selected.avgLatency}<span className="text-base text-muted-foreground ml-1">ms</span></div></div>
        </div>

        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl">Cost trend · 24h</h2>
            <div className="label-mono">hourly</div>
          </div>
          <div className="border-t border-b border-hairline py-6">
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 24 }).map((_, i) => {
                const h = 20 + Math.abs(Math.sin(i * 0.7 + selected.path.length)) * 80;
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
              { key: "ts", label: "Timestamp", render: (r) => <span className="font-mono text-xs">{r.ts}</span> },
              { key: "model", label: "Model", render: (r) => <span className="font-mono">{r.model}</span> },
              { key: "inputTokens", label: "In", align: "right", render: (r) => fmtNum(r.inputTokens) },
              { key: "outputTokens", label: "Out", align: "right", render: (r) => fmtNum(r.outputTokens) },
              { key: "cost", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost) },
              { key: "status", label: "Status", align: "right", render: (r) => <span className={`font-mono text-xs ${r.status === "200" ? "" : "text-negative"}`}>{r.status}</span> },
            ]}
            rows={history}
          />
        </section>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Endpoints" meta={`${endpoints.length} endpoints tracked`}>
      <p className="text-sm text-muted-foreground max-w-2xl mb-8">
        Routes are derived from the <span className="font-mono text-foreground">endpoint</span> tag passed to <span className="font-mono text-foreground">track()</span>.
        Click any row for request history, cost trend, and model breakdown.
      </p>
      <DataTable
        columns={[
          { key: "path", label: "Endpoint", render: (r) => <span className="font-mono">{r.path}</span> },
          { key: "requests", label: "Requests", align: "right", render: (r) => fmtNum(r.requests) },
          { key: "cost", label: "Total cost", align: "right", render: (r) => fmtUSD(r.cost) },
          { key: "avgCost", label: "Avg / req", align: "right", render: (r) => <span className="text-muted-foreground">{fmtUSD(r.avgCost)}</span> },
          { key: "avgLatency", label: "Avg latency", align: "right", render: (r) => `${r.avgLatency} ms` },
        ]}
        rows={sorted}
        onRowClick={(r) => setSelected(r)}
      />
    </AppLayout>
  );
}

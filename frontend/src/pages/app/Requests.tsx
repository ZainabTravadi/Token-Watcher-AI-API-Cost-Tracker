import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { logs, endpoints, models, fmtUSD, fmtNum } from "@/lib/data";

export default function Requests() {
  const [endpoint, setEndpoint] = useState("all");
  const [model, setModel] = useState("all");

  const filtered = useMemo(
    () => logs.filter((l) => (endpoint === "all" || l.endpoint === endpoint) && (model === "all" || l.model === model)),
    [endpoint, model]
  );

  return (
    <AppLayout title="Request log" meta={`${filtered.length} of ${logs.length} entries`}>
      <div className="flex items-end gap-6 hairline pb-5 mb-2">
        <div>
          <div className="label-mono mb-1.5">Endpoint</div>
          <select value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="input-rect w-56">
            <option value="all">— all endpoints —</option>
            {endpoints.map((e) => <option key={e.path} value={e.path}>{e.path}</option>)}
          </select>
        </div>
        <div>
          <div className="label-mono mb-1.5">Model</div>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="input-rect w-56">
            <option value="all">— all models —</option>
            {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setEndpoint("all"); setModel("all"); }}
          className="text-sm link-underline pb-2"
        >
          reset filters
        </button>
        <div className="flex-1" />
        <div className="text-xs font-mono text-muted-foreground pb-2">tail -f · auto-refresh 5s</div>
      </div>

      <DataTable
        columns={[
          { key: "ts", label: "Timestamp", render: (r) => <span className="font-mono text-xs">{r.ts}</span> },
          { key: "endpoint", label: "Endpoint", render: (r) => <span className="font-mono">{r.endpoint}</span> },
          { key: "model", label: "Model", render: (r) => <span className="font-mono text-xs">{r.model}</span> },
          { key: "inputTokens", label: "Input", align: "right", render: (r) => fmtNum(r.inputTokens) },
          { key: "outputTokens", label: "Output", align: "right", render: (r) => fmtNum(r.outputTokens) },
          { key: "cost", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost) },
          { key: "status", label: "Status", align: "right", render: (r) => (
            <span className={`font-mono text-xs ${r.status === "200" ? "text-positive" : "text-negative"}`}>{r.status}</span>
          ) },
        ]}
        rows={filtered}
      />
    </AppLayout>
  );
}

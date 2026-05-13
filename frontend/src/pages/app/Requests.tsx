import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { fmtUSD, fmtNum } from "@/lib/data";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAnalyticsSnapshotQuery, useTelemetryRowsQuery } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function Requests() {
  const [endpoint, setEndpoint] = useState("all");
  const [model, setModel] = useState("all");
  const { currentWorkspace } = useAuth();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const telemetry = useTelemetryRowsQuery(currentWorkspace?.id);

  const filtered = useMemo(() => {
    const rows = telemetry.data ?? [];
    return rows.filter((l) => (endpoint === "all" || l.route === endpoint) && (model === "all" || l.model === model));
  }, [endpoint, model, telemetry.data]);

  if (analytics.isLoading || telemetry.isLoading) {
    return (
      <AppLayout title="Request log" meta="loading telemetry…">
        <PageLoadingState rows={8} />
      </AppLayout>
    );
  }

  if (analytics.isError || telemetry.isError || !analytics.data) {
    return (
      <AppLayout title="Request log" meta="backend unavailable">
        <PageErrorState title="Could not load request log" message="The backend API is unreachable. Confirm the simulator is running and reload." />
      </AppLayout>
    );
  }

  const endpoints = analytics.data.endpoints;
  const models = analytics.data.models;

  return (
    <AppLayout title="Request log" meta={`${filtered.length} of ${telemetry.data?.length ?? 0} entries`}>
      <div className="flex items-end gap-6 hairline pb-5 mb-2">
        <div>
          <div className="label-mono mb-1.5">Endpoint</div>
          <select value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="input-rect w-56">
            <option value="all">— all endpoints —</option>
            {endpoints.map((e) => <option key={e.route} value={e.route}>{e.route}</option>)}
          </select>
        </div>
        <div>
          <div className="label-mono mb-1.5">Model</div>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="input-rect w-56">
            <option value="all">— all models —</option>
            {models.map((m) => <option key={m.model} value={m.model}>{m.model}</option>)}
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
          { key: "timestamp", label: "Timestamp", render: (r) => <span className="font-mono text-xs">{new Date(r.timestamp).toLocaleString()}</span> },
          { key: "route", label: "Endpoint", render: (r) => <span className="font-mono">{r.route}</span> },
          { key: "model", label: "Model", render: (r) => <span className="font-mono text-xs">{r.model}</span> },
          { key: "input_tokens", label: "Input", align: "right", render: (r) => fmtNum(r.input_tokens) },
          { key: "output_tokens", label: "Output", align: "right", render: (r) => fmtNum(r.output_tokens) },
          { key: "cost_usd", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost_usd) },
          { key: "error", label: "Status", align: "right", render: (r) => (
            <span className={`font-mono text-xs ${!r.error ? "text-positive" : r.error.startsWith("HTTP_429") ? "text-amber-600" : "text-negative"}`}>
              {!r.error ? "200" : r.error.startsWith("HTTP_429") ? "429" : "500"}
            </span>
          ) },
        ]}
        rows={filtered}
      />
    </AppLayout>
  );
}

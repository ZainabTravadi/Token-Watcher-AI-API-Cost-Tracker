import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { fmtUSD, fmtNum } from "@/lib/data";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAnalyticsSnapshotQuery } from "@/lib/api";

export default function Models() {
  const analytics = useAnalyticsSnapshotQuery();

  if (analytics.isLoading) {
    return (
      <AppLayout title="Models" meta="loading analytics…">
        <PageLoadingState rows={5} />
      </AppLayout>
    );
  }

  if (analytics.isError || !analytics.data) {
    return (
      <AppLayout title="Models" meta="backend unavailable">
        <PageErrorState title="Could not load models" message="The backend API is unavailable. Start TokenWatch backend and try again." />
      </AppLayout>
    );
  }

  const sorted = [...analytics.data.models].sort((a, b) => b.cost_usd - a.cost_usd);
  return (
    <AppLayout title="Models" meta={`${sorted.length} models in use`}>
      <p className="text-sm text-muted-foreground max-w-2xl mb-8">
        Token counts are read from the model's response. Cost is resolved against the published per-1K token rate at the time of the request.
      </p>
      <DataTable
        columns={[
          { key: "model", label: "Model", render: (r) => (
            <div>
              <div className="font-mono">{r.model}</div>
              <div className="label-mono mt-0.5">{r.provider}</div>
            </div>
          ) },
          { key: "requests", label: "Requests", align: "right", render: (r) => fmtNum(r.requests) },
          { key: "tokens", label: "Tokens", align: "right", render: (r) => fmtNum(r.tokens) },
          { key: "avg_latency_ms", label: "Avg latency", align: "right", render: (r) => `${Math.round(r.avg_latency_ms)} ms` },
          { key: "cost_usd", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost_usd) },
        ]}
        rows={sorted}
      />
    </AppLayout>
  );
}

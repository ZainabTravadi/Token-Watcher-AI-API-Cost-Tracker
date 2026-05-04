import AppLayout from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { models, fmtUSD, fmtNum } from "@/lib/data";

export default function Models() {
  const sorted = [...models].sort((a, b) => b.cost - a.cost);
  return (
    <AppLayout title="Models" meta={`${models.length} models in use`}>
      <p className="text-sm text-muted-foreground max-w-2xl mb-8">
        Token counts are read from the model's response. Cost is resolved against the published per-1K token rate at the time of the request.
      </p>
      <DataTable
        columns={[
          { key: "name", label: "Model", render: (r) => (
            <div>
              <div className="font-mono">{r.name}</div>
              <div className="label-mono mt-0.5">{r.provider}</div>
            </div>
          ) },
          { key: "requests", label: "Requests", align: "right", render: (r) => fmtNum(r.requests) },
          { key: "tokens", label: "Tokens", align: "right", render: (r) => fmtNum(r.tokens) },
          { key: "avgLatency", label: "Avg latency", align: "right", render: (r) => `${r.avgLatency} ms` },
          { key: "cost", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost) },
        ]}
        rows={sorted}
      />
    </AppLayout>
  );
}

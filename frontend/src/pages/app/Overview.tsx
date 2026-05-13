import AppLayout from "@/components/AppLayout";
import { Stat } from "@/components/Stat";
import { DataTable } from "@/components/DataTable";
import { fmtUSD, fmtNum, fmtPercent } from "@/lib/data";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAnalyticsSnapshotQuery } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function Overview() {
  const { currentWorkspace } = useAuth();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);

  if (analytics.isLoading) {
    return (
      <AppLayout title="Overview" meta="loading analytics…">
        <PageLoadingState rows={6} />
      </AppLayout>
    );
  }

  if (analytics.isError || !analytics.data) {
    return (
      <AppLayout title="Overview" meta="backend unavailable">
        <PageErrorState title="Could not load analytics" message="The backend API is unreachable. Confirm TokenWatch backend is running on port 3001, then refresh." />
      </AppLayout>
    );
  }

  const topEndpoints = [...analytics.data.endpoints].slice(0, 5);
  const topModels = [...analytics.data.models].slice(0, 5);
  const recent = analytics.data.recent.slice(0, 8);
  const maxEndpointCost = Math.max(...topEndpoints.map((e) => e.cost_usd), 1);
  const overview = analytics.data.overview;

  return (
    <AppLayout title="Overview" meta={`updated ${new Date().toLocaleTimeString()}`}>
      {/* Top stats */}
      <div className="grid grid-cols-4 gap-10 hairline pb-8">
        <Stat
          label="Total spend · today"
          value={fmtUSD(overview.spendToday)}
          sub={`of ${fmtUSD(overview.budget)} budget`}
          bar={{ value: overview.spendToday, max: overview.budget, label: `${Math.round((overview.spendToday / overview.budget) * 100)}% used` }}
        />
        <Stat label="Requests · today" value={fmtNum(overview.requestsToday)} sub="live simulated volume" />
        <Stat label="Avg cost / request" value={fmtUSD(overview.avgCostPerRequest)} sub="rolling 24h average" />
        <Stat label="Errors · 24h" value={fmtPercent(overview.errorRate)} sub={`429: ${fmtNum(overview.errors429)} · 500: ${fmtNum(overview.errors500)}`} />
      </div>

      {/* Spend by endpoint with bars */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-xl">Spend by endpoint</h2>
          <div className="label-mono">last 24h · sorted by cost</div>
        </div>
        <div className="border-t border-hairline">
          {topEndpoints.map((e) => (
            <div key={e.route} className="grid grid-cols-12 gap-4 items-center py-2.5 border-b border-hairline/60">
              <div className="col-span-3 font-mono text-sm">{e.route}</div>
              <div className="col-span-5">
                <div className="h-[6px] bg-secondary relative">
                  <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${(e.cost_usd / maxEndpointCost) * 100}%` }} />
                </div>
              </div>
              <div className="col-span-2 text-right text-sm num text-muted-foreground">{fmtNum(e.requests)} req</div>
              <div className="col-span-2 text-right text-sm num">{fmtUSD(e.cost_usd)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Two-column: models + recent */}
      <section className="grid grid-cols-12 gap-12 mt-14">
        <div className="col-span-7">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl">Spend by model</h2>
            <div className="label-mono">top 5</div>
          </div>
          <DataTable
            columns={[
              { key: "model", label: "Model", render: (r) => <span className="font-mono">{r.model}</span> },
              { key: "requests", label: "Requests", align: "right", render: (r) => fmtNum(r.requests) },
              { key: "tokens", label: "Tokens", align: "right", render: (r) => fmtNum(r.tokens) },
              { key: "cost_usd", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost_usd) },
            ]}
            rows={topModels}
          />
        </div>
        <div className="col-span-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl">Recent activity</h2>
            <div className="label-mono">live · last 8</div>
          </div>
          <ul className="border-t border-hairline">
            {recent.map((l, i) => (
              <li key={i} className="py-2 border-b border-hairline/60 grid grid-cols-12 gap-2 text-xs">
                <span className="col-span-4 font-mono text-muted-foreground">{l.ts.slice(11)}</span>
                <span className="col-span-4 font-mono">{l.endpoint}</span>
                <span className="col-span-2 font-mono text-muted-foreground truncate">{l.model.split("-")[0]}</span>
                <span className="col-span-2 text-right num">{fmtUSD(l.cost)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppLayout>
  );
}

import AppLayout from "@/components/AppLayout";
import { Stat } from "@/components/Stat";
import { DataTable } from "@/components/DataTable";
import { endpoints, models, logs, totals, fmtUSD, fmtNum } from "@/lib/data";

export default function Overview() {
  const topEndpoints = [...endpoints].sort((a, b) => b.cost - a.cost).slice(0, 5);
  const topModels = [...models].sort((a, b) => b.cost - a.cost).slice(0, 5);
  const recent = logs.slice(0, 8);
  const maxEndpointCost = Math.max(...topEndpoints.map((e) => e.cost));

  return (
    <AppLayout title="Overview" meta={`updated ${new Date().toLocaleTimeString()}`}>
      {/* Top stats */}
      <div className="grid grid-cols-4 gap-10 hairline pb-8">
        <Stat
          label="Total spend · today"
          value={fmtUSD(totals.spendToday)}
          sub={`of ${fmtUSD(totals.budget)} budget`}
          bar={{ value: totals.spendToday, max: totals.budget, label: `${Math.round((totals.spendToday / totals.budget) * 100)}% used` }}
        />
        <Stat label="Requests · today" value={fmtNum(totals.requestsToday)} sub="+12.4% vs yesterday" />
        <Stat label="Avg cost / request" value={fmtUSD(totals.avgCostPerRequest)} sub="−3.1% vs 7d avg" />
        <Stat label="Errors · 24h" value="0.41%" sub="429: 312 · 500: 14" />
      </div>

      {/* Spend by endpoint with bars */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-xl">Spend by endpoint</h2>
          <div className="label-mono">last 24h · sorted by cost</div>
        </div>
        <div className="border-t border-hairline">
          {topEndpoints.map((e) => (
            <div key={e.path} className="grid grid-cols-12 gap-4 items-center py-2.5 border-b border-hairline/60">
              <div className="col-span-3 font-mono text-sm">{e.path}</div>
              <div className="col-span-5">
                <div className="h-[6px] bg-secondary relative">
                  <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${(e.cost / maxEndpointCost) * 100}%` }} />
                </div>
              </div>
              <div className="col-span-2 text-right text-sm num text-muted-foreground">{fmtNum(e.requests)} req</div>
              <div className="col-span-2 text-right text-sm num">{fmtUSD(e.cost)}</div>
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
              { key: "name", label: "Model", render: (r) => <span className="font-mono">{r.name}</span> },
              { key: "requests", label: "Requests", align: "right", render: (r) => fmtNum(r.requests) },
              { key: "tokens", label: "Tokens", align: "right", render: (r) => fmtNum(r.tokens) },
              { key: "cost", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost) },
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

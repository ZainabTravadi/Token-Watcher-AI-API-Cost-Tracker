import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Stat } from "@/components/Stat";
import { DataTable } from "@/components/DataTable";
import { fmtUSD, fmtNum, fmtPercent, fmtRelativeTime, fmtCompactNum } from "@/lib/data";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { useAnalyticsSnapshotQuery } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useStatus } from "@/contexts/StatusContext";
import { WarmupPlaceholder } from "@/components/WarmupPlaceholder";

export default function Overview() {
  const { currentWorkspace } = useAuth();
  const { simulatorStatus, streamStatus, lastTelemetryEventAt } = useStatus();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick((tick) => tick + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Show warmup state
  const isWarmingUp = simulatorStatus === "warming up" || simulatorStatus === "starting";
  const hasData = analytics.data && analytics.data.overview.requestsToday > 0;
  const lastUpdatedAt = Math.max(analytics.dataUpdatedAt ?? 0, lastTelemetryEventAt ?? 0);
  const relativeTime = fmtRelativeTime(lastUpdatedAt || Date.now());

  if (analytics.isLoading && !hasData) {
    return (
      <AppLayout title="Overview" meta={isWarmingUp ? "warming up…" : "loading analytics…"}>
        <PageLoadingState rows={6} />
      </AppLayout>
    );
  }

  if (analytics.isError || !analytics.data) {
    return (
      <AppLayout title="Overview" meta="backend unavailable">
        <PageErrorState 
          title="Could not load analytics" 
          message="The backend API is unreachable. Confirm TokenWatch backend is running on port 3001, then refresh." 
        />
      </AppLayout>
    );
  }

  const topEndpoints = [...analytics.data.endpoints].slice(0, 5);
  const topModels = [...analytics.data.models].slice(0, 5);
  const recent = analytics.data.recent.slice(0, 8).filter((row, index, rows) => {
    const key = `${row.ts}|${row.endpoint}|${row.model}|${row.cost}|${row.status}`;
    return rows.findIndex((candidate) => `${candidate.ts}|${candidate.endpoint}|${candidate.model}|${candidate.cost}|${candidate.status}` === key) === index;
  });
  const maxEndpointCost = Math.max(...topEndpoints.map((e) => e.cost_usd), 1);
  const overview = analytics.data.overview;
  const timelineCosts = analytics.data.timeline.map((bucket) => bucket.cost_usd);
  const sparklineMax = Math.max(...timelineCosts, 0.000001);
  const sparkline = timelineCosts.slice(-12).map((point) => Math.max(2, Math.round((point / sparklineMax) * 16)));
  const budgetUsedPercent = overview.budget > 0 ? Math.min(100, Math.round((overview.spendToday / overview.budget) * 100)) : 0;
  const budgetRemaining = Math.max(0, overview.budget - overview.spendToday);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projectedMonthlySpend = Math.max(overview.spendToday * daysInMonth, overview.spendToday);
  const requestsPerHour = analytics.data.timeline.length > 0 ? analytics.data.timeline[analytics.data.timeline.length - 1].requests : overview.requestsToday / 24;
  const failureCount = Math.max(0, Math.round(overview.requestsToday * overview.errorRate));
  const errorsNetwork = overview.errorsNetwork ?? Math.max(0, failureCount - overview.errors429 - overview.errors500);
  const errorSub = `${fmtNum(failureCount)} failures · 429 ${fmtNum(overview.errors429)} · 500 ${fmtNum(overview.errors500)} · network ${fmtNum(errorsNetwork)}`;
  const metaLabel = streamStatus === "offline" ? `updated ${relativeTime} · offline` : streamStatus === "reconnecting" ? `updated ${relativeTime} · reconnecting` : `updated ${relativeTime}`;

  return (
    <AppLayout title="Overview" meta={metaLabel}>
      {isWarmingUp && (
        <div className="mb-8">
          <WarmupPlaceholder
            title="warming up telemetry"
            description="bootstrapping analytics · waiting for first requests"
            bootstrappingPercent={analytics.data?.overview.requestsToday ? 100 : 24}
          />
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-1 gap-8 hairline pb-8 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Total spend today"
          value={fmtUSD(overview.spendToday)}
          sub={`live spend · ${fmtCompactNum(overview.requestsToday)} reqs · ${fmtUSD(overview.budget)} budget`}
          sparkline={sparkline}
        />
        <Stat 
          label="Requests today" 
          value={fmtCompactNum(overview.requestsToday)} 
          sub={`${fmtCompactNum(requestsPerHour)} / hr velocity`} 
        />
        <Stat 
          label="Avg cost / request" 
          value={overview.requestsToday > 0 ? fmtUSD(overview.avgCostPerRequest) : "$0.00"} 
          sub="rolling 24h average" 
        />
        <Stat 
          label="Errors 24h" 
          value={fmtPercent(overview.errorRate)} 
          sub={errorSub}
        />
        <Stat
          label="Budget usage"
          value={`${budgetUsedPercent}%`}
          sub={`spent ${fmtUSD(overview.spendToday)} · remaining ${fmtUSD(budgetRemaining)} · projected ${fmtUSD(projectedMonthlySpend)}/mo`}
          bar={{ value: overview.spendToday, max: overview.budget, label: overview.budget > 0 ? `${fmtUSD(budgetRemaining)} left` : "no budget set" }}
        />
      </div>

      {/* Spend by endpoint with bars */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-xl">Spend by endpoint</h2>
          <div className="label-mono">last 24h · sorted by cost</div>
        </div>
        <div className="border-t border-hairline">
          {topEndpoints.length > 0 ? (
            topEndpoints.map((e) => (
              <div key={e.route} className="grid grid-cols-12 gap-4 items-center py-2.5 border-b border-hairline/60">
                <div className="col-span-3 font-mono text-sm">{e.route}</div>
                <div className="col-span-5">
                  <div className="h-[6px] bg-secondary relative overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-foreground transition-all duration-300" 
                      style={{ width: `${(e.cost_usd / maxEndpointCost) * 100}%` }} 
                    />
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm num text-muted-foreground">{fmtCompactNum(e.requests)} req</div>
                <div className="col-span-2 text-right text-sm num">{fmtUSD(e.cost_usd)}</div>
              </div>
            ))
          ) : (
            <div className="py-6 text-xs text-muted-foreground text-center">{isWarmingUp ? "warming up telemetry" : "no data yet"}</div>
          )}
        </div>
      </section>

      {/* Two-column: models + recent */}
      <section className="grid grid-cols-12 gap-12 mt-14">
        <div className="col-span-7">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl">Spend by model</h2>
            <div className="label-mono">top 5</div>
          </div>
          {topModels.length > 0 ? (
            <DataTable
              columns={[
                { key: "model", label: "Model", render: (r) => <span className="font-mono">{r.model}</span> },
                { key: "requests", label: "Requests", align: "right", render: (r) => fmtCompactNum(r.requests) },
                { key: "tokens", label: "Tokens", align: "right", render: (r) => fmtCompactNum(r.tokens) },
                { key: "cost_usd", label: "Cost", align: "right", render: (r) => fmtUSD(r.cost_usd) },
                { key: "avg_latency_ms", label: "Avg latency", align: "right", render: (r) => `${Math.round(r.avg_latency_ms)} ms` },
              ]}
              rows={topModels}
              getRowKey={(r) => `${r.model}-${r.provider}`}
            />
          ) : (
            <div className="py-6 text-xs text-muted-foreground text-center border-t border-hairline">{isWarmingUp ? "bootstrapping analytics" : "no data yet"}</div>
          )}
        </div>
        <div className="col-span-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl">Recent activity</h2>
            <div className="label-mono">live · last 8</div>
          </div>
          {recent.length > 0 ? (
            <ul className="border-t border-hairline">
              {recent.map((l) => {
                const traceId = `${l.ts}|${l.endpoint}|${l.model}|${l.cost}|${l.status}`;

                return (
                  <li key={traceId} className="py-2 border-b border-hairline/60 grid grid-cols-12 gap-2 text-xs transition-colors duration-200 hover:bg-secondary/40" data-trace-id={traceId} title="click to trace coming soon">
                    <span className="col-span-4 font-mono text-muted-foreground" title={l.ts}>{fmtRelativeTime(l.ts)}</span>
                    <span className="col-span-4 font-mono truncate">{l.endpoint}</span>
                    <span className="col-span-2 font-mono text-muted-foreground truncate">{l.model}/{l.provider}</span>
                    <span className={`col-span-2 text-right num ${l.status === "200" ? "" : "text-amber-600"}`}>
                      {fmtUSD(l.cost)}
                    </span>
                    <span className="col-span-12 -mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>{l.status}</span>
                      <span>{fmtCompactNum(l.inputTokens + l.outputTokens)} tok</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-6 text-xs text-muted-foreground text-center border-t border-hairline">{isWarmingUp ? "waiting for first requests" : "no activity yet"}</div>
          )}
        </div>
      </section>
    </AppLayout>
  );
}

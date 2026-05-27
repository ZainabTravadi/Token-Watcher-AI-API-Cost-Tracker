import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Stat } from "@/components/Stat";
import { DataTable } from "@/components/DataTable";
import { RequestDetailDrawer } from "@/components/RequestDetailDrawer";
import { SdkOnboarding } from "@/components/SdkOnboarding";
import { fmtUSD, fmtNum, fmtPercent, fmtRelativeTime, fmtCompactNum } from "@/lib/data";
import { PageErrorState, PageLoadingState } from "@/components/AsyncState";
import { type TelemetryRow, useAnalyticsSnapshotQuery, useTelemetryRowsQuery } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useStatus } from "@/contexts/StatusContext";

export default function Overview() {
  const { currentWorkspace } = useAuth();
  const { streamStatus, lastTelemetryEventAt } = useStatus();
  const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
  const telemetry = useTelemetryRowsQuery(currentWorkspace?.id, 25);
  const [selectedRequest, setSelectedRequest] = useState<TelemetryRow | null>(null);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick((tick) => tick + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasData = analytics.data && analytics.data.overview.requestsToday > 0;
  const lastUpdatedAt = Math.max(analytics.dataUpdatedAt ?? 0, lastTelemetryEventAt ?? 0);
  const relativeTime = fmtRelativeTime(lastUpdatedAt || Date.now());

  if (analytics.isLoading && !hasData) {
    return (
      <AppLayout title="Overview" meta="loading analytics...">
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
  const recentRows = (telemetry.data ?? []).slice(0, 8);
  const hasWorkspaceTelemetry =
    analytics.data.dimensions.models.length > 0 ||
    analytics.data.dimensions.providers.length > 0 ||
    analytics.data.dimensions.routes.length > 0 ||
    recentRows.length > 0;
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
  const previousHour = analytics.data.timeline.length > 1 ? analytics.data.timeline[analytics.data.timeline.length - 2].requests : 0;
  const requestTrend = requestsPerHour > previousHour ? "up" : requestsPerHour < previousHour ? "down" : "steady";
  const failureCount = Math.max(0, Math.round(overview.requestsToday * overview.errorRate));
  const errorsNetwork = overview.errorsNetwork ?? Math.max(0, failureCount - overview.errors429 - overview.errors500);
  const errorSub = `${fmtNum(failureCount)} failures · 429 ${fmtNum(overview.errors429)} · 500 ${fmtNum(overview.errors500)} · network ${fmtNum(errorsNetwork)}`;
  const metaLabel = streamStatus === "offline" ? `updated ${relativeTime} | offline` : streamStatus === "reconnecting" ? `updated ${relativeTime} | reconnecting` : `updated ${relativeTime} | ${streamStatus}`;

  return (
    <>
    <AppLayout title="Overview" meta={metaLabel}>
      {!hasWorkspaceTelemetry && currentWorkspace && (
        <div className="mb-10">
          <SdkOnboarding workspace={currentWorkspace} />
        </div>
      )}

      <div className="mb-8 flex flex-col gap-2 border-y border-hairline py-3 text-xs font-mono text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>stream {streamStatus}</span>
        <span>{lastTelemetryEventAt ? `last telemetry ${fmtRelativeTime(lastTelemetryEventAt + clockTick * 0)}` : "waiting for first telemetry event"}</span>
      </div>

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
          sub={`${fmtCompactNum(requestsPerHour)} / hr velocity | ${requestTrend}`} 
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
              <div key={e.route} className="grid grid-cols-12 gap-4 items-center py-2 border-b border-hairline/60">
                <div className="col-span-3 font-mono text-sm truncate">{e.route}</div>
                <div className="col-span-5">
                  <div className="h-2.5 bg-secondary/30 relative overflow-hidden rounded">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-foreground/90 to-foreground/60 transition-all duration-300 rounded"
                      style={{ width: `${(e.cost_usd / maxEndpointCost) * 100}%`, minWidth: `${Math.min(6, (e.cost_usd / maxEndpointCost) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm num text-muted-foreground">{fmtCompactNum(e.requests)} req</div>
                <div className="col-span-2 text-right text-sm num font-mono">{fmtUSD(e.cost_usd)}</div>
              </div>
            ))
          ) : (
            <div className="py-6 text-xs text-muted-foreground text-center">No endpoint telemetry yet — install the SDK or check your stream connection.</div>
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
            <div className="py-6 text-xs text-muted-foreground text-center border-t border-hairline">No model telemetry yet — waiting for live telemetry from your workspace.</div>
          )}
        </div>
        <div className="col-span-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl">Recent activity</h2>
            <div className="label-mono">live · last 8</div>
          </div>
          {recentRows.length > 0 ? (
            <ul className="border-t border-hairline">
              {recentRows.map((row) => {
                const statusOk = !row.error;
                return (
                  <li key={row.id} onClick={() => setSelectedRequest(row)} className="py-2 border-b border-hairline/60 grid grid-cols-12 gap-2 text-xs transition hover:bg-secondary/40 hover:shadow-sm cursor-pointer">
                    <span className="col-span-1 flex items-center justify-start">
                      <span className={`w-2 h-2 rounded-full ${statusOk ? "bg-green-500" : "bg-amber-600"} mr-2`} />
                    </span>
                    <span className="col-span-3 font-mono text-muted-foreground truncate" title={new Date(row.timestamp).toISOString()}>{fmtRelativeTime(row.timestamp)}</span>
                    <span className="col-span-4 font-mono truncate">{row.route}</span>
                    <span className="col-span-2 font-mono text-muted-foreground truncate">{row.model}/{row.provider}</span>
                    <span className={`col-span-2 text-right num ${row.error ? "text-amber-600" : ""}`}>
                      {fmtUSD(row.cost_usd)}
                    </span>
                    <span className="col-span-12 -mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>{row.error ? "ERR" : "200"}</span>
                      <span>{fmtCompactNum(row.total_tokens)} tok</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-6 text-xs text-muted-foreground text-center border-t border-hairline">No recent telemetry yet — open the console and trigger requests to see live activity.</div>
          )}
        </div>
      </section>
    </AppLayout>
    <RequestDetailDrawer open={Boolean(selectedRequest)} request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </>
  );
}

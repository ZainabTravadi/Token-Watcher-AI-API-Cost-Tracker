import { useStatus } from "@/contexts/StatusContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, Database, Activity, Zap, Signal, AlertCircle, Cpu, HardDrive, RadioTower, ShieldCheck } from "lucide-react";

const ICON_SIZE = "w-3.5 h-3.5";

// Version Badge Component
function VersionBadge() {
  const { appVersion, releaseChannel, isHealthLoading } = useStatus();

  if (isHealthLoading) {
    return <Skeleton className="h-5 w-24" />;
  }

  const releaseColor = {
    stable: "text-muted-foreground",
    beta: "text-amber-600",
    nightly: "text-foreground"
  }[releaseChannel];

  return (
    <div className="flex items-center gap-1">
      <Code2 className={`${ICON_SIZE} text-muted-foreground`} />
      <span className="font-mono text-xs">
        v{appVersion}
        {releaseChannel !== "stable" && (
          <span className={`ml-1 ${releaseColor}`}>·{releaseChannel}</span>
        )}
      </span>
    </div>
  );
}

// Environment Badge Component
function EnvironmentBadge() {
  const { environment, environmentBadgeColor, isHealthLoading } = useStatus();

  if (isHealthLoading) {
    return <Skeleton className="h-5 w-20" />;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${environmentBadgeColor}`}>
      <span className="h-1.5 w-1.5 bg-current opacity-60" />
      {environment}
    </div>
  );
}

// Database Status Component
function DatabaseStatus() {
  const { databaseStatus, databaseResponseTime, databaseColor, isHealthLoading } = useStatus();

  if (isHealthLoading) {
    return <Skeleton className="h-5 w-32" />;
  }

  const statusIcon = {
    connected: <Signal className={`${ICON_SIZE} text-green-600`} />,
    reconnecting: <AlertCircle className={`${ICON_SIZE} text-amber-600`} />,
    offline: <Database className={`${ICON_SIZE} text-red-600`} />,
    degraded: <AlertCircle className={`${ICON_SIZE} text-orange-600`} />
  }[databaseStatus];

  return (
    <div className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] ${databaseColor}`}>
      {statusIcon}
      db: {databaseStatus}
      {databaseResponseTime > 0 && <span className="opacity-60">({databaseResponseTime}ms)</span>}
    </div>
  );
}

// Telemetry Count Component
function TelemetryCount() {
  const { telemetryCountFormatted, telemetryCount, isHealthLoading } = useStatus();

  if (isHealthLoading) {
    return <Skeleton className="h-5 w-24" />;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
      <Activity className={`${ICON_SIZE} text-muted-foreground`} />
      <span title={`${telemetryCount.toLocaleString()} total rows`}>
        {telemetryCountFormatted} rows
      </span>
    </div>
  );
}

function ServiceBadge({ label, value, healthy = true }: { label: string; value: string; healthy?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] ${healthy ? "bg-green-500/10 text-green-700" : "bg-amber-500/10 text-amber-700"}`}>
      <span className="h-1.5 w-1.5 bg-current opacity-70" />
      {label}: {value}
    </div>
  );
}

function PlatformServices() {
  const { health, streamStatus, databaseStatus, isHealthLoading } = useStatus();

  if (isHealthLoading) {
    return (
      <>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-24" />
      </>
    );
  }

  const dbOk = databaseStatus === "connected";
  const streamOk = streamStatus === "live";
  const telemetryOk = (health?.telemetry.totalRows ?? 0) > 0 || health?.telemetry.status === "active";
  const simulatorStatus = health?.simulator.status ?? "offline";

  return (
    <>
      <ServiceBadge label="telemetry" value={health?.telemetry.status ?? "idle"} healthy={telemetryOk} />
      <ServiceBadge label="forecast" value={dbOk ? "ready" : "waiting"} healthy={dbOk} />
      <ServiceBadge label="copilot" value={dbOk ? "ready" : "limited"} healthy={dbOk} />
      <ServiceBadge label="sdk" value={streamOk ? "receiving" : "standby"} healthy={streamOk || telemetryOk} />
      <ServiceBadge label="agent" value={simulatorStatus} healthy={simulatorStatus === "live" || simulatorStatus === "paused"} />
    </>
  );
}

// Stream Status Component
function StreamStatus() {
  const { streamStatus, streamStatusColor, isHealthLoading } = useStatus();

  if (isHealthLoading) {
    return <Skeleton className="h-5 w-28" />;
  }

  const statusIcon = {
    connecting: <Zap className={`${ICON_SIZE}`} />,
    live: (
      <span className="relative flex items-center justify-center">
        <span className="absolute h-2 w-2 animate-pulse bg-positive opacity-40" />
        <Signal className={`${ICON_SIZE} text-green-600`} />
      </span>
    ),
    reconnecting: <AlertCircle className={`${ICON_SIZE} text-amber-600`} />,
    offline: <Zap className={`${ICON_SIZE} text-red-600`} />
  }[streamStatus];

  return (
    <div className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] ${streamStatusColor}`}>
      {statusIcon}
      stream: {streamStatus}
    </div>
  );
}

// Main GlobalStatusHeader Component
export function GlobalStatusHeader() {
  const { isHealthLoading } = useStatus();

  return (
    <header className="border-b border-hairline bg-background">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg font-medium">TokenWatcher</span>
            <span className="h-4 w-px bg-hairline" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">console</span>
          </div>

          <div className="flex items-center gap-3">
            <VersionBadge />
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <EnvironmentBadge />
          <span className="h-3 w-px bg-hairline" />
          <DatabaseStatus />
          <span className="h-3 w-px bg-hairline" />
          <TelemetryCount />
          <span className="h-3 w-px bg-hairline" />
          <StreamStatus />

          <span className="h-3 w-px bg-hairline" />
          <PlatformServices />

          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="inline-flex items-center gap-1"><HardDrive className={ICON_SIZE} /> workspace</span>
            <span className="inline-flex items-center gap-1"><RadioTower className={ICON_SIZE} /> sync</span>
            <span className="inline-flex items-center gap-1"><Cpu className={ICON_SIZE} /> api</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className={ICON_SIZE} /> governance</span>
            {isHealthLoading && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse bg-muted-foreground" />
                updating
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

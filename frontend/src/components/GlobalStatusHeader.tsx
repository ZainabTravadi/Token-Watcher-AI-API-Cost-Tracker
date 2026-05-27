import { useStatus } from "@/contexts/StatusContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, Database, Activity, Zap, Signal, AlertCircle } from "lucide-react";

const ICON_SIZE = "w-3.5 h-3.5";

// Version Badge Component
function VersionBadge() {
  const { appVersion, releaseChannel, isHealthLoading } = useStatus();

  if (isHealthLoading) {
    return <Skeleton className="h-5 w-24" />;
  }

  const releaseColor = {
    stable: "text-gray-600",
    beta: "text-amber-600",
    nightly: "text-purple-600"
  }[releaseChannel];

  return (
    <div className="flex items-center gap-1">
      <Code2 className={`${ICON_SIZE} text-gray-400`} />
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
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${environmentBadgeColor}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
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
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${databaseColor}`}>
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
    <div className="flex items-center gap-1.5 text-xs font-mono text-gray-600">
      <Activity className={`${ICON_SIZE} text-gray-400`} />
      <span title={`${telemetryCount.toLocaleString()} total rows`}>
        {telemetryCountFormatted} rows
      </span>
    </div>
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
        <span className="absolute w-2 h-2 bg-green-600 rounded-full opacity-40 animate-pulse" />
        <Signal className={`${ICON_SIZE} text-green-600`} />
      </span>
    ),
    reconnecting: <AlertCircle className={`${ICON_SIZE} text-amber-600`} />,
    offline: <Zap className={`${ICON_SIZE} text-red-600`} />
  }[streamStatus];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${streamStatusColor}`}>
      {statusIcon}
      stream: {streamStatus}
    </div>
  );
}

// Main GlobalStatusHeader Component
export function GlobalStatusHeader() {
  const { isHealthLoading } = useStatus();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        {/* Primary Row: Branding and Version */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg font-medium">TokenWatch</span>
            <span className="w-px h-4 bg-gray-300" />
            <span className="text-xs text-gray-500">console</span>
          </div>

          {/* Status Icons Mini Row */}
          <div className="flex items-center gap-3">
            <VersionBadge />
          </div>
        </div>

        {/* Secondary Row: Status Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <EnvironmentBadge />
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <DatabaseStatus />
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <TelemetryCount />
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <StreamStatus />

          {/* Refresh indicator */}
          {isHealthLoading && (
            <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
              updating
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

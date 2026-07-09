import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceInfo } from "@/contexts/AuthContext";
import type { WorkspaceUsageResponse } from "./api";
import { SettingsSection } from "./SettingsSection";

interface SettingsUsageSectionProps {
  workspace: WorkspaceInfo;
  usage?: WorkspaceUsageResponse;
  isLoading: boolean;
  error: string | null;
}

function formatDate(value?: number | null): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function formatCurrency(value?: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value ?? 0);
}

function UsageItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="break-words text-sm font-medium">{value}</div>
    </div>
  );
}

export function SettingsUsageSection({ workspace, usage, isLoading, error }: SettingsUsageSectionProps) {
  return (
    <SettingsSection n="07" title="Usage information" desc="Read-only workspace and SDK metadata.">
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <UsageItem label="Workspace ID" value={workspace.id} />
          <UsageItem label="Created" value={formatDate(workspace.created_at)} />
          <UsageItem label="API version" value={usage?.api_version ?? "Not available"} />
          <UsageItem label="SDK version" value={usage?.sdk_version ?? "Not available"} />
          <UsageItem label="Telemetry count" value={String(usage?.telemetry_count ?? 0)} />
          <UsageItem label="Current month spend" value={formatCurrency(usage?.current_month_spend)} />
        </div>
      )}
    </SettingsSection>
  );
}

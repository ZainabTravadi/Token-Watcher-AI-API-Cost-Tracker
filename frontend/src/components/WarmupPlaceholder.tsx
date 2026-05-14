import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

interface WarmupPlaceholderProps {
  title: string;
  description?: string;
  bootstrappingPercent?: number;
}

/**
 * Subtle placeholder shown while workspace is bootstrapping with telemetry
 * Instead of harsh "0 requests" empty state, shows "warming up telemetry"
 */
export function WarmupPlaceholder({ title, description, bootstrappingPercent }: WarmupPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 p-3 bg-amber-50 rounded-lg">
        <Activity className="w-6 h-6 text-amber-600 animate-pulse" />
      </div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 mb-4 max-w-sm">{description}</p>
      )}
      {bootstrappingPercent !== undefined && (
        <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${bootstrappingPercent}%` }}
          />
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3">
        {bootstrappingPercent !== undefined ? `${Math.round(bootstrappingPercent)}% complete` : "Starting simulator..."}
      </p>
    </div>
  );
}

/**
 * Skeleton loaders for analytics cards while warming up
 */
export function AnalyticsCardSkeleton() {
  return (
    <div className="space-y-3 p-4 border border-gray-100 rounded-lg bg-white">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

import { memo, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const ChartPanel = memo(function ChartPanel({
  title,
  meta,
  children,
  isLoading,
  isError,
  isEmpty,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
}) {
  return (
    <section className="min-h-[320px] border-t border-hairline pt-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl">{title}</h2>
        {meta && <div className="label-mono">{meta}</div>}
      </div>
      {isLoading ? (
        <div className="grid h-[260px] gap-3">
          <Skeleton className="h-full w-full" />
        </div>
      ) : isError ? (
        <div className="flex h-[260px] items-center justify-center border border-destructive/30 bg-destructive/5 text-xs text-destructive">
          Could not load chart data.
        </div>
      ) : isEmpty ? (
        <div className="flex h-[260px] items-center justify-center border border-dashed border-hairline px-6 text-center text-xs text-muted-foreground">
          No telemetry matches this date range and filter set.
        </div>
      ) : (
        children
      )}
    </section>
  );
});

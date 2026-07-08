import { ArrowDownRight, ArrowRight, ArrowUpRight, HelpCircle } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title: string;
  value: string;
  previousValue: string;
  changePercent: number;
  sparkline: number[];
  tooltip: string;
  onClick?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
}

export const KpiCard = memo(function KpiCard({
  title,
  value,
  previousValue,
  changePercent,
  sparkline,
  tooltip,
  onClick,
  isLoading,
  isError,
  isEmpty,
  emptyLabel = "No data for this range",
}: KpiCardProps) {
  const [flash, setFlash] = useState(false);
  const trend = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat";
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
  const normalized = sparkline.length ? sparkline : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...normalized, 0.000001);

  useEffect(() => {
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 220);
    return () => window.clearTimeout(timer);
  }, [value]);

  if (isLoading) {
    return (
      <div className="min-h-[170px] border-t border-hairline py-4">
        <Skeleton className="mb-4 h-3 w-28" />
        <Skeleton className="mb-3 h-8 w-24" />
        <Skeleton className="mb-4 h-3 w-36" />
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group min-h-[170px] w-full border-t border-hairline py-4 text-left transition duration-200",
        onClick && "cursor-pointer hover:border-foreground/40 hover:bg-secondary/30",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="label-mono truncate">{title}</div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </div>

      {isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Could not load this metric.
        </div>
      ) : isEmpty ? (
        <div className="rounded-md border border-dashed border-hairline p-3 text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <>
          <div className={cn("font-serif text-3xl leading-none num transition-all duration-200", flash && "translate-y-[-1px] opacity-85")}>
            {value}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>previous {previousValue}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                trend === "up" && "bg-green-500/10 text-green-700",
                trend === "down" && "bg-amber-500/10 text-amber-700",
                trend === "flat" && "bg-secondary text-muted-foreground",
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(changePercent).toFixed(1)}%
            </span>
          </div>
          <div className="mt-4 flex h-8 items-end gap-[3px]" aria-hidden="true">
            {normalized.map((point, index) => (
              <span
                key={`${point}-${index}`}
                className="min-w-[4px] flex-1 rounded-sm bg-foreground/70 transition-all duration-500 group-hover:bg-foreground"
                style={{ height: `${Math.max(4, Math.round((point / max) * 32))}px` }}
              />
            ))}
          </div>
        </>
      )}
    </button>
  );
});

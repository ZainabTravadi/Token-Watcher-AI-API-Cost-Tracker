import { memo } from "react";
import { cn } from "@/lib/utils";

export interface HealthScore {
  label: string;
  value: number;
  detail: string;
}

export const HealthScorePanel = memo(function HealthScorePanel({
  title,
  scores,
}: {
  title: string;
  scores: HealthScore[];
}) {
  return (
    <section className="border-t border-hairline pt-5">
      <h2 className="mb-4 font-serif text-xl">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {scores.map((score) => {
          const value = Math.max(0, Math.min(100, Math.round(score.value)));
          return (
            <div key={score.label} className="rounded-md border border-hairline bg-background p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div className="label-mono truncate">{score.label}</div>
                <div className="font-serif text-2xl num">{value}</div>
              </div>
              <div className="h-2 overflow-hidden rounded bg-secondary">
                <div
                  className={cn("h-full rounded transition-[width] duration-500", value >= 80 ? "bg-green-600" : value >= 55 ? "bg-amber-600" : "bg-destructive")}
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{score.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
});

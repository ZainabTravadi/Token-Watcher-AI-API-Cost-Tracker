import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { fmtPercent, fmtUSD } from "@/lib/data";

export interface Recommendation {
  title: string;
  detail: string;
  impact: string;
  savingsUsd?: number;
  efficiencyGain?: number;
}

export const RecommendationPanel = memo(function RecommendationPanel({
  title,
  recommendations,
  isEmpty,
}: {
  title: string;
  recommendations: Recommendation[];
  isEmpty?: boolean;
}) {
  return (
    <section className="border-t border-hairline pt-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl">{title}</h2>
        <Badge variant="outline" className="rounded-sm border-hairline bg-secondary/40 font-mono text-[10px] uppercase tracking-[0.18em]">
          AI efficiency
        </Badge>
      </div>
      {isEmpty || recommendations.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline p-5 text-sm text-muted-foreground">
          No recommendations are available for the current filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {recommendations.map((recommendation) => (
            <article key={recommendation.title} className="rounded-md border border-hairline bg-background p-4 transition hover:bg-secondary/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-mono text-sm">{recommendation.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{recommendation.detail}</p>
                </div>
                <div className="shrink-0 text-left font-mono text-xs text-muted-foreground sm:text-right">
                  <div>{recommendation.impact}</div>
                  {recommendation.savingsUsd !== undefined && <div>{fmtUSD(recommendation.savingsUsd)} potential savings</div>}
                  {recommendation.efficiencyGain !== undefined && <div>{fmtPercent(recommendation.efficiencyGain, 1)} efficiency lift</div>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
});

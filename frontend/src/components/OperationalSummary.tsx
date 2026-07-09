import { cn } from "@/lib/utils";

export type OperationalSummaryItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
};

const toneClass: Record<NonNullable<OperationalSummaryItem["tone"]>, string> = {
  neutral: "text-foreground",
  good: "text-positive",
  warn: "text-amber-700",
  bad: "text-negative",
};

export function OperationalSummary({ items, className }: { items: OperationalSummaryItem[]; className?: string }) {
  return (
    <section className={cn("mb-8 border-y border-hairline", className)} aria-label="Operational summary">
      <div className="grid grid-cols-2 divide-x-0 divide-y divide-hairline md:grid-cols-4 md:divide-x md:divide-y-0 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 px-3 py-3">
            <div className="label-mono mb-1 truncate">{item.label}</div>
            <div className={cn("num truncate text-sm font-medium", toneClass[item.tone ?? "neutral"])} title={item.value}>
              {item.value}
            </div>
            {item.detail && <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={item.detail}>{item.detail}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

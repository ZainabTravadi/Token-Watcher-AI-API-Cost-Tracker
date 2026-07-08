import { Check, Filter, X } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { OverviewFilterKey, OverviewFilters } from "@/hooks/useOverviewFilters";

export interface FilterOptionGroup {
  key: OverviewFilterKey;
  label: string;
  options: string[];
}

export const GlobalFilters = memo(function GlobalFilters({
  groups,
  values,
  onChange,
  onClear,
}: {
  groups: FilterOptionGroup[];
  values: OverviewFilters;
  onChange: (key: OverviewFilterKey, values: string[]) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const activeCount = useMemo(() => groups.reduce((sum, group) => sum + values[group.key].length, 0), [groups, values]);

  const toggle = (key: OverviewFilterKey, option: string) => {
    const selected = values[key];
    onChange(key, selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex flex-wrap items-center gap-2">
        {groups.flatMap((group) =>
          values[group.key].map((value) => (
            <button
              key={`${group.key}-${value}`}
              type="button"
              onClick={() => onChange(group.key, values[group.key].filter((item) => item !== value))}
              className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-hairline px-2 py-1 text-xs font-mono transition hover:bg-secondary"
            >
              <span className="truncate">{group.label}: {value}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          )),
        )}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 font-mono">
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 && <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background">{activeCount}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,420px)]">
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="label-mono">Global filters</div>
              <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={activeCount === 0}>
                Clear all
              </Button>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search filters"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="max-h-[60vh] overflow-auto pr-1">
              {groups.map((group) => {
                const visibleOptions = group.options.filter((option) => option.toLowerCase().includes(search.toLowerCase()));
                return (
                  <div key={group.key} className="border-t border-hairline py-3 first:border-t-0 first:pt-0">
                    <div className="mb-2 text-xs font-mono text-muted-foreground">{group.label}</div>
                    <div className="grid gap-1">
                      {visibleOptions.length > 0 ? (
                        visibleOptions.map((option) => {
                          const selected = values[group.key].includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => toggle(group.key, option)}
                              className={cn(
                                "flex min-h-9 items-center justify-between gap-3 rounded-md px-2 text-left text-sm transition hover:bg-secondary",
                                selected && "bg-secondary",
                              )}
                            >
                              <span className="truncate font-mono">{option}</span>
                              {selected && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-2 text-xs text-muted-foreground">No matches</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {activeCount > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="shrink-0 font-mono">
          Clear all
        </Button>
      )}
    </div>
  );
});

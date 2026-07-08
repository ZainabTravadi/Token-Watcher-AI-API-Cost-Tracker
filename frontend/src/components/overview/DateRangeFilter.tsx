import { CalendarDays } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPresetRange, type DateRangePreset, type DateRangeValue } from "@/hooks/useOverviewFilters";

const PRESETS: Array<{ label: string; value: DateRangePreset }> = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
];

export const DateRangeFilter = memo(function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const label = value.preset === "custom" ? `${value.from} to ${value.to}` : PRESETS.find((preset) => preset.value === value.preset)?.label ?? "Today";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-start font-mono">
          <CalendarDays className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="grid gap-3">
          <div className="label-mono">Date range</div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={value.preset === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => onChange(getPresetRange(preset.value))}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-hairline pt-3">
            <label className="grid gap-1 text-xs font-mono text-muted-foreground">
              From
              <input
                type="date"
                value={value.from}
                onChange={(event) => onChange({ preset: "custom", from: event.target.value, to: value.to })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="grid gap-1 text-xs font-mono text-muted-foreground">
              To
              <input
                type="date"
                value={value.to}
                onChange={(event) => onChange({ preset: "custom", from: value.from, to: event.target.value })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              />
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

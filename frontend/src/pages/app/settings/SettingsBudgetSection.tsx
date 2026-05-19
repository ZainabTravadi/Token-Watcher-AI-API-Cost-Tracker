import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";

interface SettingsBudgetSectionProps {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

export function SettingsBudgetSection({ value, error, onChange }: SettingsBudgetSectionProps) {
  return (
    <SettingsSection
      n="03"
      title="Monthly budget"
      desc="A soft limit. Requests are never blocked; TokenWatch uses it for alerting context."
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm">USD</span>
          <Input
            type="number"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            step="10"
            min="0"
            className={`w-40 ${error ? "border-red-500" : ""}`}
          />
          <span className="text-xs text-muted-foreground font-mono">/ month</span>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </SettingsSection>
  );
}

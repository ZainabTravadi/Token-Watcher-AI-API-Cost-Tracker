import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";

interface SettingsAlertsSectionProps {
  alertHighCost: boolean;
  alertErrors: boolean;
  thresholdDraft: string;
  sliderValue: number;
  error: string | null;
  isSaving: boolean;
  onToggleHighCost: (enabled: boolean) => void;
  onToggleErrors: (enabled: boolean) => void;
  onThresholdInputChange: (value: string) => void;
  onThresholdSliderChange: (value: number) => void;
  onSaveThreshold: () => void;
}

export function SettingsAlertsSection({
  alertHighCost,
  alertErrors,
  thresholdDraft,
  sliderValue,
  error,
  isSaving,
  onToggleHighCost,
  onToggleErrors,
  onThresholdInputChange,
  onThresholdSliderChange,
  onSaveThreshold,
}: SettingsAlertsSectionProps) {
  return (
    <SettingsSection n="04" title="Alerts" desc="Notifications for high costs and failed requests.">
      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={alertHighCost}
            onChange={(event) => onToggleHighCost(event.target.checked)}
            disabled={isSaving}
          />
          <span className="text-sm">Alert on high cost</span>
          {isSaving && <span className="text-xs text-muted-foreground">(saving...)</span>}
        </label>

        {alertHighCost && (
          <div className="flex flex-col gap-3 ml-7">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Threshold:</span>
              <input
                type="range"
                min="1"
                max="100"
                value={sliderValue}
                onChange={(event) => onThresholdSliderChange(Number(event.target.value))}
                className="flex-1"
                disabled={isSaving}
              />
              <Input
                type="number"
                value={thresholdDraft}
                onChange={(event) => onThresholdInputChange(event.target.value)}
                step="1"
                min="1"
                max="100"
                className={`w-20 text-center ${error ? "border-red-500" : ""}`}
                disabled={isSaving}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Button type="button" variant="outline" size="sm" onClick={onSaveThreshold} disabled={isSaving}>
                Save
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={alertErrors}
            onChange={(event) => onToggleErrors(event.target.checked)}
            disabled={isSaving}
          />
          <span className="text-sm">Alert on errors</span>
          {isSaving && <span className="text-xs text-muted-foreground">(saving...)</span>}
        </label>
      </div>
    </SettingsSection>
  );
}

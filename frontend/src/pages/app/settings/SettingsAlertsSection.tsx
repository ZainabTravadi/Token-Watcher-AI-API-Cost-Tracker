import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";

interface SettingsAlertsSectionProps {
  alertHighCost: boolean;
  alertErrors: boolean;
  alertLatency: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  thresholdDraft: string;
  latencyThresholdDraft: string;
  dailyDigestTime: string;
  digestTimezone: string;
  weeklyReportDay: string;
  weeklyReportTime: string;
  recipientEmail: string;
  recipientVerified: boolean;
  sliderValue: number;
  error: string | null;
  latencyError: string | null;
  isSaving: boolean;
  onToggleHighCost: (enabled: boolean) => void;
  onToggleErrors: (enabled: boolean) => void;
  onToggleLatency: (enabled: boolean) => void;
  onToggleDailyDigest: (enabled: boolean) => void;
  onToggleWeeklyReport: (enabled: boolean) => void;
  onThresholdInputChange: (value: string) => void;
  onLatencyThresholdInputChange: (value: string) => void;
  onDailyDigestTimeChange: (value: string) => void;
  onDigestTimezoneChange: (value: string) => void;
  onWeeklyReportDayChange: (value: string) => void;
  onWeeklyReportTimeChange: (value: string) => void;
  onThresholdSliderChange: (value: number) => void;
  onSaveThreshold: () => void;
  onSaveAlerts: () => void;
  onSendDailyDigest: () => void;
  onSendWeeklyReport: () => void;
}

export function SettingsAlertsSection({
  alertHighCost,
  alertErrors,
  alertLatency,
  dailyDigest,
  weeklyReport,
  thresholdDraft,
  latencyThresholdDraft,
  dailyDigestTime,
  digestTimezone,
  weeklyReportDay,
  weeklyReportTime,
  recipientEmail,
  recipientVerified,
  sliderValue,
  error,
  latencyError,
  isSaving,
  onToggleHighCost,
  onToggleErrors,
  onToggleLatency,
  onToggleDailyDigest,
  onToggleWeeklyReport,
  onThresholdInputChange,
  onLatencyThresholdInputChange,
  onDailyDigestTimeChange,
  onDigestTimezoneChange,
  onWeeklyReportDayChange,
  onWeeklyReportTimeChange,
  onThresholdSliderChange,
  onSaveThreshold,
  onSaveAlerts,
  onSendDailyDigest,
  onSendWeeklyReport,
}: SettingsAlertsSectionProps) {
  return (
    <SettingsSection n="05" title="Alerts" desc="Notifications for high costs, failed requests, latency, and reports.">
      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={alertHighCost}
            onChange={(event) => onToggleHighCost(event.target.checked)}
            disabled={isSaving}
          />
          <span className="text-sm">High Cost Alerts</span>
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
          <span className="text-sm">Error Alerts</span>
          {isSaving && <span className="text-xs text-muted-foreground">(saving...)</span>}
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={alertLatency}
            onChange={(event) => onToggleLatency(event.target.checked)}
            disabled={isSaving}
          />
          <span className="text-sm">Latency Alerts</span>
          <Input
            type="number"
            value={latencyThresholdDraft}
            onChange={(event) => onLatencyThresholdInputChange(event.target.value)}
            step="100"
            min="1"
            max="120000"
            className={`ml-auto w-28 text-center ${latencyError ? "border-red-500" : ""}`}
            disabled={isSaving || !alertLatency}
          />
          <span className="text-xs text-muted-foreground">ms</span>
        </label>
        {latencyError && <p className="ml-7 text-xs text-red-600">{latencyError}</p>}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dailyDigest}
            onChange={(event) => onToggleDailyDigest(event.target.checked)}
            disabled={isSaving}
          />
          <span className="text-sm">Daily digest</span>
          <Input
            type="time"
            value={dailyDigestTime}
            onChange={(event) => onDailyDigestTimeChange(event.target.value)}
            className="ml-auto w-28"
            disabled={isSaving || !dailyDigest}
          />
        </label>

        <label className="ml-7 grid gap-1 text-xs text-muted-foreground">
          Timezone
          <Input
            value={digestTimezone}
            onChange={(event) => onDigestTimezoneChange(event.target.value)}
            onBlur={(event) => onDigestTimezoneChange(event.target.value.trim())}
            placeholder="UTC"
            className="max-w-xs font-mono"
            disabled={isSaving || (!dailyDigest && !weeklyReport)}
          />
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={weeklyReport}
            onChange={(event) => onToggleWeeklyReport(event.target.checked)}
            disabled={isSaving}
          />
          <span className="text-sm">Weekly Executive Report</span>
          <select
            value={weeklyReportDay}
            onChange={(event) => onWeeklyReportDayChange(event.target.value)}
            className="ml-auto input-rect w-36"
            disabled={isSaving || !weeklyReport}
          >
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          <Input
            type="time"
            value={weeklyReportTime}
            onChange={(event) => onWeeklyReportTimeChange(event.target.value)}
            className="w-28"
            disabled={isSaving || !weeklyReport}
          />
        </label>

        <div className="border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
          <div className="label-mono mb-2">Preview</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>Recipient: <span className="font-mono text-foreground">{recipientEmail || "not configured"}</span></div>
            <div>Email status: <span className={recipientVerified ? "font-mono text-positive" : "font-mono text-amber-700"}>{recipientVerified ? "verified" : "unverified"}</span></div>
            <div>High cost: <span className="font-mono text-foreground">{alertHighCost ? `${thresholdDraft || "?"}%` : "off"}</span></div>
            <div>Error alerts: <span className="font-mono text-foreground">{alertErrors ? "on" : "off"}</span></div>
            <div>Latency alerts: <span className="font-mono text-foreground">{alertLatency ? `${latencyThresholdDraft || "?"} ms` : "off"}</span></div>
            <div>Next daily digest: <span className="font-mono text-foreground">{dailyDigest ? `Tomorrow ${dailyDigestTime} ${digestTimezone}` : "off"}</span></div>
            <div>Next weekly report: <span className="font-mono text-foreground">{weeklyReport ? `${weeklyReportDay} ${weeklyReportTime} ${digestTimezone}` : "off"}</span></div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onSaveAlerts} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save alert settings"}
          </Button>
          <Button type="button" variant="ghost" onClick={onSendDailyDigest} disabled={isSaving || !dailyDigest || !recipientEmail || !recipientVerified}>
            Send daily now
          </Button>
          <Button type="button" variant="ghost" onClick={onSendWeeklyReport} disabled={isSaving || !weeklyReport || !recipientEmail || !recipientVerified}>
            Send weekly now
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}

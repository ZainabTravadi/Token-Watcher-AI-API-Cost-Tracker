import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";

interface SettingsWebhookSectionProps {
  value: string;
  error: string | null;
  isSaving: boolean;
  isTesting: boolean;
  lastTestAt: number | null;
  lastStatus: string | null;
  lastResponseCode: number | null;
  lastResponseTimeMs: number | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onTest: () => void;
}

export function SettingsWebhookSection({
  value,
  error,
  isSaving,
  isTesting,
  lastTestAt,
  lastStatus,
  lastResponseCode,
  lastResponseTimeMs,
  onChange,
  onSave,
  onTest,
}: SettingsWebhookSectionProps) {
  return (
    <SettingsSection
      n="06"
      title="Webhook URL"
      desc="POST notifications to this endpoint. Payloads are JSON and reserved for signed delivery."
    >
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onChange(event.target.value.trim())}
            placeholder="https://hooks.example.com/tokenwatch"
            className={`flex-1 ${error ? "border-red-500" : ""}`}
            disabled={isSaving}
          />
          <Button type="button" variant="outline" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onTest} disabled={isSaving || isTesting || !value.trim()}>
            {isTesting ? "Testing..." : "Test"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <span className="label-mono">Last test</span>
            <div>{lastTestAt ? new Date(lastTestAt).toLocaleString() : "Never"}</div>
          </div>
          <div>
            <span className="label-mono">Last status</span>
            <div>
              {lastStatus ?? "Not tested"}
              {lastResponseCode ? ` (${lastResponseCode})` : ""}
              {lastResponseTimeMs ? ` in ${lastResponseTimeMs} ms` : ""}
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";

interface SettingsWebhookSectionProps {
  value: string;
  error: string | null;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function SettingsWebhookSection({ value, error, isSaving, onChange, onSave }: SettingsWebhookSectionProps) {
  return (
    <SettingsSection
      n="05"
      title="Webhook URL"
      desc="POST notifications to this endpoint. Payloads are JSON and reserved for signed delivery."
    >
      <div className="space-y-2">
        <div className="flex gap-2">
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
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </SettingsSection>
  );
}

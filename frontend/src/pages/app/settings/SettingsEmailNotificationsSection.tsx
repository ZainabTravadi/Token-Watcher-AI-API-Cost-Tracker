import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";

interface SettingsEmailNotificationsSectionProps {
  value: string;
  error: string | null;
  verified: boolean;
  lastTestAt: number | null;
  isSaving: boolean;
  isTesting: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onTest: () => void;
}

export function SettingsEmailNotificationsSection({
  value,
  error,
  verified,
  lastTestAt,
  isSaving,
  isTesting,
  onChange,
  onSave,
  onTest,
}: SettingsEmailNotificationsSectionProps) {
  return (
    <SettingsSection n="04" title="Email Notifications" desc="Recipient and delivery status for governance alerts, digests, and reports.">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onBlur={(event) => onChange(event.target.value.trim())}
              placeholder="operator@example.com"
              className={`pl-9 ${error ? "border-red-500" : ""}`}
              disabled={isSaving || isTesting}
            />
          </div>
          <Button type="button" variant="outline" onClick={onSave} disabled={isSaving || isTesting}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onTest} disabled={isSaving || isTesting || !value.trim()}>
            <Send className="mr-2 h-4 w-4" />
            {isTesting ? "Sending..." : "Test Email"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="grid gap-3 border-t border-hairline pt-3 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <span className="label-mono">Recipient Email</span>
            <div className="break-all font-mono text-foreground">{value || "Not configured"}</div>
          </div>
          <div>
            <span className="label-mono">Verification Status</span>
            <div className={verified ? "font-mono text-positive" : "font-mono text-amber-700"}>{verified ? "Verified" : "Unverified"}</div>
          </div>
          <div>
            <span className="label-mono">Last test</span>
            <div>{lastTestAt ? new Date(lastTestAt).toLocaleString() : "Never"}</div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

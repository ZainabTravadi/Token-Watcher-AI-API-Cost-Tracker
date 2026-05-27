import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "./SettingsSection";

interface SettingsWorkspaceNameSectionProps {
  value: string;
  error: string | null;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function SettingsWorkspaceNameSection({ value, error, isSaving, onChange, onSave }: SettingsWorkspaceNameSectionProps) {
  return (
    <SettingsSection n="02" title="Workspace name" desc="The display name used in the console and workspace switcher.">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="My Workspace"
            className={error ? "border-red-500" : ""}
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

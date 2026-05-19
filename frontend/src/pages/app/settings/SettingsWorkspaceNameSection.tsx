import { Input } from "@/components/ui/input";
import { SettingsSection } from "./SettingsSection";

interface SettingsWorkspaceNameSectionProps {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

export function SettingsWorkspaceNameSection({ value, error, onChange }: SettingsWorkspaceNameSectionProps) {
  return (
    <SettingsSection n="02" title="Workspace name" desc="The display name used in the console and workspace switcher.">
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="My Workspace"
          className={error ? "border-red-500" : ""}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </SettingsSection>
  );
}

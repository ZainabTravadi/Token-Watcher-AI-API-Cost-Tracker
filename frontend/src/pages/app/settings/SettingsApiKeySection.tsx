import { Copy, Eye, EyeOff, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceInfo } from "@/contexts/AuthContext";
import { SettingsSection } from "./SettingsSection";

interface SettingsApiKeySectionProps {
  workspace: WorkspaceInfo;
  plainApiKey: string | null;
  showApiKey: boolean;
  isRotating: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onRequestRotate: () => void;
}

export function SettingsApiKeySection({
  workspace,
  plainApiKey,
  showApiKey,
  isRotating,
  onToggleReveal,
  onCopy,
  onRequestRotate,
}: SettingsApiKeySectionProps) {
  return (
    <SettingsSection
      n="01"
      title="API key"
      desc="Used by the TokenWatch SDK to identify this workspace. Rotation revokes existing integrations immediately."
    >
      <div className="space-y-4">
        {plainApiKey ? (
          <div className="flex gap-2">
            <Input
              type={showApiKey ? "text" : "password"}
              value={plainApiKey}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={onToggleReveal} disabled={isRotating} title={showApiKey ? "Hide API key" : "Reveal API key"}>
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCopy} disabled={isRotating} title="Copy API key to clipboard">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : workspace.apiKey ? (
          <div className="text-sm space-y-2">
            <div className="font-mono text-xs text-muted-foreground">
              Active key generated{" "}
              {new Date(workspace.apiKey.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              The secret is shown only when a key is created or rotated. Rotate to issue a new key.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active API key.</p>
        )}
        <Button type="button" variant="outline" onClick={onRequestRotate} disabled={isRotating} className="w-full">
          <RotateCw className={`h-4 w-4 mr-2 ${isRotating ? "animate-spin" : ""}`} />
          {isRotating ? "Rotating..." : "Rotate API key"}
        </Button>
      </div>
    </SettingsSection>
  );
}

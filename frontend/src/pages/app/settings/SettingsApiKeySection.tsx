import { Copy, KeyRound, Plus, RotateCw, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceInfo } from "@/contexts/AuthContext";
import { SettingsSection } from "./SettingsSection";
import type { ApiKeyType, WorkspaceApiKey } from "./api";

const KEY_TYPES: Array<{ value: ApiKeyType; label: string; description: string }> = [
  { value: "SDK", label: "SDK Key", description: "Telemetry ingest only" },
  { value: "OPENCLAW", label: "OpenClaw Key", description: "Analytics, reports, forecast, recommendations, copilot" },
  { value: "CI", label: "CI Key", description: "Automation ingest and reporting" },
  { value: "READONLY", label: "Read Only Key", description: "Workspace analytics and reports" },
  { value: "ADMIN", label: "Admin Key", description: "All machine permissions" },
  { value: "SERVICE", label: "Service Key", description: "General backend service access" },
];

interface SettingsApiKeySectionProps {
  workspace: WorkspaceInfo;
  keys: WorkspaceApiKey[];
  plainApiKey: string | null;
  isLoading: boolean;
  isCreating: boolean;
  isRotating: boolean;
  isRevoking: string | null;
  draftLabel: string;
  draftType: ApiKeyType;
  draftExpiresAt: string;
  onDraftLabelChange: (value: string) => void;
  onDraftTypeChange: (value: ApiKeyType) => void;
  onDraftExpiresAtChange: (value: string) => void;
  onCreate: () => void;
  onCopy: () => void;
  onRequestRotate: () => void;
  onRevoke: (keyId: string) => void;
}

function formatDate(value: number | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

function keyStatus(key: WorkspaceApiKey): "active" | "revoked" | "expired" {
  if (key.revoked_at) return "revoked";
  if (key.expires_at && key.expires_at <= Date.now()) return "expired";
  return "active";
}

export function SettingsApiKeySection({
  workspace,
  keys,
  plainApiKey,
  isLoading,
  isCreating,
  isRotating,
  isRevoking,
  draftLabel,
  draftType,
  draftExpiresAt,
  onDraftLabelChange,
  onDraftTypeChange,
  onDraftExpiresAtChange,
  onCreate,
  onCopy,
  onRequestRotate,
  onRevoke,
}: SettingsApiKeySectionProps) {
  return (
    <SettingsSection
      n="01"
      title="API keys"
      desc="Workspace-scoped machine credentials. Secrets are shown once when created or rotated."
    >
      <div className="space-y-5">
        {plainApiKey && (
          <div className="border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4" />
              Copy this secret now
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={plainApiKey} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={onCopy} className="shrink-0">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-3 border border-hairline bg-background p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Input
              value={draftLabel}
              onChange={(event) => onDraftLabelChange(event.target.value)}
              placeholder="Production OpenClaw"
              disabled={isCreating}
            />
            <select
              value={draftType}
              onChange={(event) => onDraftTypeChange(event.target.value as ApiKeyType)}
              disabled={isCreating}
              className="border border-input bg-background px-3 py-2 text-sm"
            >
              {KEY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <Input
            value={draftExpiresAt}
            onChange={(event) => onDraftExpiresAtChange(event.target.value)}
            placeholder="Optional expiration: YYYY-MM-DD"
            disabled={isCreating}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {KEY_TYPES.find((type) => type.value === draftType)?.description}
            </p>
            <Button type="button" onClick={onCreate} disabled={isCreating}>
              <Plus className="mr-2 h-4 w-4" />
              {isCreating ? "Creating..." : "Create key"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading API keys...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            keys.map((key) => {
              const status = keyStatus(key);
              return (
                <div key={key.id} className="border border-hairline bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{key.label}</span>
                        <Badge variant="outline">{key.type}</Badge>
                        <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>Created: {formatDate(key.created_at)}</div>
                        <div>Last used: {formatDate(key.last_used_at)}</div>
                        <div>Expires: {formatDate(key.expires_at)}</div>
                        <div className="font-mono">ID: {key.id}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {key.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-[10px]">{permission}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRevoke(key.id)}
                      disabled={Boolean(key.revoked_at) || isRevoking === key.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isRevoking === key.id ? "Revoking..." : "Revoke"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border border-hairline bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4" />
                Legacy SDK rotation
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Rotates only the default SDK ingest key for workspace {workspace.id}.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onRequestRotate} disabled={isRotating}>
              <RotateCw className={`mr-2 h-4 w-4 ${isRotating ? "animate-spin" : ""}`} />
              {isRotating ? "Rotating..." : "Rotate SDK key"}
            </Button>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

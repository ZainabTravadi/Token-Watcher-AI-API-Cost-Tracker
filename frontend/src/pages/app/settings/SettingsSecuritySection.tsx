import type { AuthSessionInfo, AuthUser, WorkspaceInfo } from "@/contexts/AuthContext";
import { SettingsSection } from "./SettingsSection";

interface SettingsSecuritySectionProps {
  user: AuthUser | null;
  session: AuthSessionInfo | null;
  workspace: WorkspaceInfo;
}

function formatDate(value?: number | null): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm">{value}</span>
    </div>
  );
}

export function SettingsSecuritySection({ user, session, workspace }: SettingsSecuritySectionProps) {
  const ownsWorkspace = Boolean(user?.id && workspace.user_id === user.id);
  const authMethod = session?.method === "bearer" ? "Bearer token" : "Secure cookie";

  return (
    <SettingsSection n="08" title="Security" desc="Current authentication and ownership status.">
      <div className="space-y-4">
        <div className="border p-4">
          <SecurityRow label="Authentication status" value={session?.authenticated ? "Authenticated" : "Unknown"} />
          <SecurityRow label="Session status" value={session?.status ?? "unknown"} />
          <SecurityRow label="Authentication method" value={authMethod} />
          <SecurityRow label="Workspace ownership" value={ownsWorkspace ? "Current user owns this workspace" : "Ownership unavailable"} />
          <SecurityRow label="Last login" value={formatDate(session?.issued_at)} />
          <SecurityRow label="API authentication method" value="x-api-key header" />
        </div>
        <div className="border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
          Keep rotated API keys out of client-side code, use HTTPS webhook endpoints, and rotate credentials after sharing them outside your deployment environment.
        </div>
      </div>
    </SettingsSection>
  );
}

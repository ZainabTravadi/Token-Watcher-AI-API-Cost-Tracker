import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Copy, Eye, EyeOff, RotateCw, Trash2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_TOKENWATCH_API_URL ?? "http://localhost:3001";

export default function Settings() {
  const navigate = useNavigate();
  const { currentWorkspace, refreshUser } = useAuth();
  const { toast } = useToast();

  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [name, setName] = useState(currentWorkspace?.name || "");
  const [budget, setBudget] = useState(currentWorkspace?.monthly_budget || 100);
  const [webhookUrl, setWebhookUrl] = useState(currentWorkspace?.webhook_url || "");
  const [alertHighCost, setAlertHighCost] = useState(currentWorkspace?.settings?.alert_on_high_cost ?? true);
  const [alertErrors, setAlertErrors] = useState(currentWorkspace?.settings?.alert_on_errors ?? true);
  const [costThreshold, setCostThreshold] = useState(currentWorkspace?.settings?.alert_cost_threshold ?? 50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load API key when component mounts or workspace changes
  useEffect(() => {
    if (currentWorkspace?.apiKey?.id) {
      // Key is already loaded from workspace data but hashed
      setApiKey(currentWorkspace.apiKey.id);
    }
  }, [currentWorkspace]);

  const copyApiKey = async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey);
      toast({
        title: "Copied",
        description: "API key copied to clipboard",
      });
    }
  };

  const regenerateApiKey = async () => {
    if (!currentWorkspace) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/workspaces/${currentWorkspace.id}/api-keys/regenerate`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate API key");
      }

      const data = await response.json();
      setApiKey(data.apiKey);
      toast({
        title: "Success",
        description: "API key regenerated",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to regenerate API key";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/workspaces/${currentWorkspace.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          monthly_budget: parseFloat(String(budget)),
          webhook_url: webhookUrl || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update workspace");
      }

      // Update settings
      const settingsResponse = await fetch(
        `${API_BASE_URL}/api/workspaces/${currentWorkspace.id}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            alert_on_high_cost: alertHighCost,
            alert_on_errors: alertErrors,
            alert_cost_threshold: parseFloat(String(costThreshold)),
          }),
        }
      );

      if (!settingsResponse.ok) {
        throw new Error("Failed to update settings");
      }

      await refreshUser();
      toast({
        title: "Success",
        description: "Settings saved",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkspace = async () => {
    if (!currentWorkspace) return;

    if (!window.confirm("Are you sure? This will permanently delete the workspace and all its data.")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/workspaces/${currentWorkspace.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete workspace");
      }

      toast({
        title: "Success",
        description: "Workspace deleted",
      });

      await refreshUser();
      navigate("/app");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete workspace";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <AppLayout title="Settings" meta="loading...">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No workspace selected</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings" meta={`workspace · ${currentWorkspace.name}`}>
      <form onSubmit={(e) => { e.preventDefault(); saveSettings(); }} className="max-w-2xl space-y-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* API Key Section */}
        <Section
          n="01"
          title="API key"
          desc="Used by the TokenWatch SDK to identify this workspace. Rotate any time — old keys are revoked immediately."
        >
          <div className="space-y-4">
            {apiKey && (
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyApiKey}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={regenerateApiKey}
              disabled={loading}
              className="w-full"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Regenerate Key
            </Button>
          </div>
        </Section>

        {/* Workspace Name */}
        <Section
          n="02"
          title="Workspace name"
          desc="The display name for this workspace."
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Workspace"
          />
        </Section>

        {/* Monthly Budget */}
        <Section
          n="03"
          title="Monthly budget"
          desc="A soft limit. Requests are never blocked — TokenWatch will only notify."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm">USD</span>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
              step="10"
              min="0"
              className="w-40"
            />
            <span className="text-xs text-muted-foreground font-mono">/ month</span>
          </div>
        </Section>

        {/* Alerts */}
        <Section
          n="04"
          title="Alerts"
          desc="Notifications for high costs and errors."
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={alertHighCost}
                onChange={(e) => setAlertHighCost(e.target.checked)}
              />
              <span className="text-sm">Alert on high cost</span>
            </label>
            {alertHighCost && (
              <div className="flex items-center gap-3 ml-7">
                <span className="text-xs text-muted-foreground">Threshold:</span>
                <Input
                  type="number"
                  value={costThreshold}
                  onChange={(e) => setCostThreshold(parseFloat(e.target.value) || 50)}
                  step="10"
                  min="0"
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">% of budget</span>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={alertErrors}
                onChange={(e) => setAlertErrors(e.target.checked)}
              />
              <span className="text-sm">Alert on errors</span>
            </label>
          </div>
        </Section>

        {/* Webhook URL */}
        <Section
          n="05"
          title="Webhook URL"
          desc="POST notifications to this endpoint. Payload is JSON, signed with HMAC-SHA256."
        >
          <Input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.example.com/tokenwatch"
          />
        </Section>

        <div className="border-t pt-6 flex items-center gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="mt-20 max-w-2xl">
        <div className="label-mono mb-3">Danger zone</div>
        <div className="border border-red-500/40 p-5 flex items-center justify-between bg-red-500/5">
          <div>
            <div className="font-serif text-base">Delete workspace</div>
            <div className="text-xs text-muted-foreground mt-1">
              Removes all logs, endpoints, and stored credentials. This is permanent.
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={deleteWorkspace}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete workspace
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ n, title, desc, children }: { n: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-12 gap-6 py-8 border-b">
      <div className="col-span-4">
        <div className="label-mono mb-1">§ {n}</div>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>
      </div>
      <div className="col-span-8">{children}</div>
    </section>
  );
}

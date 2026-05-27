import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { SettingsApiKeySection } from "./settings/SettingsApiKeySection";
import { SettingsAlertsSection } from "./settings/SettingsAlertsSection";
import { SettingsBudgetSection } from "./settings/SettingsBudgetSection";
import { SettingsDangerZoneSection } from "./settings/SettingsDangerZoneSection";
import { SettingsWebhookSection } from "./settings/SettingsWebhookSection";
import { SettingsWorkspaceNameSection } from "./settings/SettingsWorkspaceNameSection";
import { DangerousActionDialog } from "./settings/DangerousActionDialog";
import {
  deleteWorkspaceById,
  rotateWorkspaceApiKey,
  updateWorkspaceMeta,
  updateWorkspaceSettings,
} from "./settings/api";
import {
  validateAlertThreshold,
  validateMonthlyBudget,
  validateWebhookUrl,
  validateWorkspaceName,
} from "./settings/validation";

type AlertSettingKey = "alert_on_high_cost" | "alert_on_errors";

function settingBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : value === 0 || value === 1 ? Boolean(value) : fallback;
}

function settingNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace, refreshUser, setCurrentWorkspace } = useAuth();
  const { toast } = useToast();
  const previousWorkspaceId = useRef<string | null>(null);

  const [plainApiKey, setPlainApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [budget, setBudget] = useState("100");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [alertHighCost, setAlertHighCost] = useState(true);
  const [alertErrors, setAlertErrors] = useState(true);
  const [thresholdDraft, setThresholdDraft] = useState("50");
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  const [savingMeta, setSavingMeta] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const workspaceChanged = previousWorkspaceId.current !== currentWorkspace.id;
    previousWorkspaceId.current = currentWorkspace.id;

    setName(currentWorkspace.name);
    setBudget(String(currentWorkspace.monthly_budget));
    setWebhookUrl(currentWorkspace.webhook_url ?? "");
    setAlertHighCost(settingBool(currentWorkspace.settings?.alert_on_high_cost, true));
    setAlertErrors(settingBool(currentWorkspace.settings?.alert_on_errors, true));
    setThresholdDraft(String(settingNumber(currentWorkspace.settings?.alert_cost_threshold, 50)));
    setNameError(null);
    setBudgetError(null);
    setWebhookError(null);
    setThresholdError(null);
    setError(null);

    if (workspaceChanged) {
      setPlainApiKey(currentWorkspace.apiKey?.value ?? null);
      setShowApiKey(false);
      setDeleteConfirmation("");
      setRotateDialogOpen(false);
      setDeleteDialogOpen(false);
    }
  }, [currentWorkspace]);

  const syncWorkspaceState = async () => {
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["telemetry-rows"] });
    await queryClient.invalidateQueries({ queryKey: ["request-log"] });
    await queryClient.invalidateQueries({ queryKey: ["health"] });
  };

  const handleCopyApiKey = async () => {
    if (!plainApiKey) return;

    try {
      await navigator.clipboard.writeText(plainApiKey);
      toast({ title: "Copied", description: "New API key copied to clipboard" });
    } catch {
      toast({ title: "Error", description: "Failed to copy API key", variant: "destructive" });
    }
  };

  const handleRotateApiKey = async () => {
    if (!currentWorkspace) return;

    try {
      setRotatingKey(true);
      setError(null);
      const data = await rotateWorkspaceApiKey(currentWorkspace.id);
      setPlainApiKey(data.apiKey);
      setShowApiKey(false);
      setRotateDialogOpen(false);
      await refreshUser();
      toast({ title: "API key rotated", description: "Existing integrations must use the new key." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rotate API key";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setRotatingKey(false);
    }
  };

  const handleAlertUpdate = async (settingKey: AlertSettingKey, nextValue: boolean) => {
    if (!currentWorkspace) return;

    const previousHighCost = alertHighCost;
    const previousErrors = alertErrors;
    if (settingKey === "alert_on_high_cost") {
      setAlertHighCost(nextValue);
    } else {
      setAlertErrors(nextValue);
    }

    try {
      setSavingAlerts(true);
      await updateWorkspaceSettings(currentWorkspace.id, { [settingKey]: nextValue });
      await syncWorkspaceState();
    } catch (err) {
      setAlertHighCost(previousHighCost);
      setAlertErrors(previousErrors);
      const message = err instanceof Error ? err.message : "Failed to update alert";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleThresholdInputChange = (value: string) => {
    setThresholdDraft(value);
    setThresholdError(null);
  };

  const handleThresholdSliderChange = (value: number) => {
    setThresholdDraft(String(Math.min(100, Math.max(1, Math.round(value)))));
    setThresholdError(null);
  };

  const handleSaveThreshold = async () => {
    if (!currentWorkspace) return;

    const validation = validateAlertThreshold(thresholdDraft);
    if (!validation.valid) {
      setThresholdError(validation.error || "Invalid threshold");
      return;
    }

    const previousThreshold = String(settingNumber(currentWorkspace.settings?.alert_cost_threshold, 50));
    try {
      setSavingAlerts(true);
      setThresholdError(null);
      await updateWorkspaceSettings(currentWorkspace.id, { alert_cost_threshold: Number(thresholdDraft) });
      await syncWorkspaceState();
      toast({ title: "Threshold saved", description: "Alert threshold updated" });
    } catch (err) {
      setThresholdDraft(previousThreshold);
      const message = err instanceof Error ? err.message : "Failed to update threshold";
      setThresholdError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!currentWorkspace) return;

    const validation = validateWebhookUrl(webhookUrl);
    if (!validation.valid) {
      setWebhookError(validation.error || "Invalid webhook URL");
      return;
    }

    try {
      setSavingMeta(true);
      setWebhookError(null);
      const trimmed = webhookUrl.trim();
      await updateWorkspaceMeta(currentWorkspace.id, { webhook_url: trimmed || null });
      setWebhookUrl(trimmed);
      await syncWorkspaceState();
      toast({ title: "Webhook saved", description: trimmed ? "Webhook URL updated" : "Webhook URL cleared" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update webhook URL";
      setWebhookError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveName = async () => {
    if (!currentWorkspace) return;

    const validation = validateWorkspaceName(name);
    setNameError(validation.valid ? null : validation.error || "Invalid name");
    if (!validation.valid) return;

    try {
      setSavingMeta(true);
      setError(null);
      await updateWorkspaceMeta(currentWorkspace.id, { name: name.trim() });
      setName(name.trim());
      await syncWorkspaceState();
      toast({ title: "Workspace renamed", description: "Workspace name updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rename workspace";
      setNameError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!currentWorkspace) return;

    const validation = validateMonthlyBudget(budget);
    setBudgetError(validation.valid ? null : validation.error || "Invalid budget");
    if (!validation.valid) return;

    try {
      setSavingMeta(true);
      setError(null);
      await updateWorkspaceMeta(currentWorkspace.id, { monthly_budget: Number(budget) });
      await syncWorkspaceState();
      toast({ title: "Budget saved", description: "Monthly budget updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update monthly budget";
      setBudgetError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!currentWorkspace) return;

    const nameValidation = validateWorkspaceName(name);
    const budgetValidation = validateMonthlyBudget(budget);
    const webhookValidation = validateWebhookUrl(webhookUrl);

    setNameError(nameValidation.valid ? null : nameValidation.error || "Invalid name");
    setBudgetError(budgetValidation.valid ? null : budgetValidation.error || "Invalid budget");
    setWebhookError(webhookValidation.valid ? null : webhookValidation.error || "Invalid webhook URL");

    if (!nameValidation.valid || !budgetValidation.valid || !webhookValidation.valid) {
      return;
    }

    try {
      setSavingMeta(true);
      setError(null);
      const trimmedWebhook = webhookUrl.trim();
      await updateWorkspaceMeta(currentWorkspace.id, {
        name: name.trim(),
        monthly_budget: Number(budget),
        webhook_url: trimmedWebhook || null,
      });
      setName(name.trim());
      setWebhookUrl(trimmedWebhook);
      await syncWorkspaceState();
      toast({ title: "Settings saved", description: "Workspace settings updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;

    try {
      setDeletingWorkspace(true);
      setError(null);
      await deleteWorkspaceById(currentWorkspace.id);
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
      setPlainApiKey(null);
      setCurrentWorkspace(null);
      queryClient.clear();
      await refreshUser();
      navigate("/app", { replace: true });
      toast({ title: "Workspace deleted", description: "Workspace state and telemetry cache were cleared." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete workspace";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setDeletingWorkspace(false);
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

  const sliderValue = (() => {
    const parsed = Number(thresholdDraft);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
      ? parsed
      : settingNumber(currentWorkspace.settings?.alert_cost_threshold, 50);
  })();
  const deleteEnabled =
    deleteConfirmation === "DELETE" || deleteConfirmation.trim() === currentWorkspace.name;

  return (
    <AppLayout title="Settings" meta={`workspace | ${currentWorkspace.name}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSaveSettings();
        }}
        className="max-w-2xl space-y-8"
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <SettingsApiKeySection
          workspace={currentWorkspace}
          plainApiKey={plainApiKey}
          showApiKey={showApiKey}
          isRotating={rotatingKey}
          onToggleReveal={() => setShowApiKey((visible) => !visible)}
          onCopy={() => void handleCopyApiKey()}
          onRequestRotate={() => setRotateDialogOpen(true)}
        />

        <SettingsWorkspaceNameSection
          value={name}
          error={nameError}
          isSaving={savingMeta}
          onChange={(value) => {
            setName(value);
            setNameError(null);
          }}
          onSave={() => void handleSaveName()}
        />

        <SettingsBudgetSection
          value={budget}
          error={budgetError}
          isSaving={savingMeta}
          onChange={(value) => {
            setBudget(value);
            setBudgetError(null);
          }}
          onSave={() => void handleSaveBudget()}
        />

        <SettingsAlertsSection
          alertHighCost={alertHighCost}
          alertErrors={alertErrors}
          thresholdDraft={thresholdDraft}
          sliderValue={sliderValue}
          error={thresholdError}
          isSaving={savingAlerts}
          onToggleHighCost={(enabled) => void handleAlertUpdate("alert_on_high_cost", enabled)}
          onToggleErrors={(enabled) => void handleAlertUpdate("alert_on_errors", enabled)}
          onThresholdInputChange={handleThresholdInputChange}
          onThresholdSliderChange={handleThresholdSliderChange}
          onSaveThreshold={() => void handleSaveThreshold()}
        />

        <SettingsWebhookSection
          value={webhookUrl}
          error={webhookError}
          isSaving={savingMeta}
          onChange={(value) => {
            setWebhookUrl(value);
            setWebhookError(null);
          }}
          onSave={() => void handleSaveWebhook()}
        />

        <div className="border-t pt-6 flex items-center gap-4">
          <Button type="submit" disabled={savingMeta}>
            {savingMeta ? "Saving..." : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
        </div>
      </form>

      <SettingsDangerZoneSection
        isDeleting={deletingWorkspace}
        onRequestDelete={() => {
          setDeleteConfirmation("");
          setDeleteDialogOpen(true);
        }}
      />

      <DangerousActionDialog
        open={rotateDialogOpen}
        onOpenChange={setRotateDialogOpen}
        title="Rotate workspace API key"
        description="The current API key will be revoked immediately. Any SDK or ingestion process using it will fail until the new key is installed."
        confirmLabel="Rotate key"
        pendingLabel="Rotating..."
        isPending={rotatingKey}
        onConfirm={() => void handleRotateApiKey()}
      >
        <div className="border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          The new secret will be shown once. Copy it before leaving this screen.
        </div>
      </DangerousActionDialog>

      <DangerousActionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete workspace"
        description="This permanently deletes the workspace, telemetry rows, settings, and active credentials. The action cannot be undone."
        confirmLabel="Delete workspace"
        pendingLabel="Deleting..."
        isPending={deletingWorkspace}
        disabled={!deleteEnabled}
        onConfirm={() => void handleDeleteWorkspace()}
      >
        <div className="space-y-3">
          <div className="border border-red-500/30 bg-red-500/5 p-3 text-xs text-muted-foreground">
            Type <span className="font-mono text-foreground">{currentWorkspace.name}</span> or{" "}
            <span className="font-mono text-foreground">DELETE</span> to confirm.
          </div>
          <Input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            disabled={deletingWorkspace}
            autoComplete="off"
            className="font-mono"
          />
        </div>
      </DangerousActionDialog>
    </AppLayout>
  );
}

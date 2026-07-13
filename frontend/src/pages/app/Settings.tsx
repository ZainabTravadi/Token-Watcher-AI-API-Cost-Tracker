import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SettingsApiKeySection } from "./settings/SettingsApiKeySection";
import { SettingsAlertsSection } from "./settings/SettingsAlertsSection";
import { SettingsBudgetSection } from "./settings/SettingsBudgetSection";
import { SettingsDangerZoneSection } from "./settings/SettingsDangerZoneSection";
import { SettingsEmailNotificationsSection } from "./settings/SettingsEmailNotificationsSection";
import { SettingsSecuritySection } from "./settings/SettingsSecuritySection";
import { SettingsTelegramSection } from "./settings/SettingsTelegramSection";
import { SettingsUsageSection } from "./settings/SettingsUsageSection";
import { SettingsWebhookSection } from "./settings/SettingsWebhookSection";
import { SettingsWorkspaceNameSection } from "./settings/SettingsWorkspaceNameSection";
import { DangerousActionDialog } from "./settings/DangerousActionDialog";
import {
  deleteWorkspaceById,
  createWorkspaceApiKey,
  connectTelegramIntegration,
  fetchWorkspaceApiKeys,
  fetchTelegramIntegrationStatus,
  fetchWorkspaceUsage,
  disconnectTelegramIntegration,
  regenerateTelegramOpenClawKey,
  revokeWorkspaceApiKey,
  rotateWorkspaceApiKey,
  sendDailyDigest,
  sendTestEmail,
  sendWeeklyReport,
  testWorkspaceWebhook,
  testTelegramIntegration,
  updateWorkspaceMeta,
  updateWorkspaceSettings,
  verifyTelegramBot,
  type ApiKeyType,
} from "./settings/api";
import {
  validateAlertThreshold,
  validateLatencyThreshold,
  validateMonthlyBudget,
  validateNotificationEmail,
  validateTimeValue,
  validateTimezone,
  validateWebhookUrl,
  validateWorkspaceName,
} from "./settings/validation";

type AlertSettingKey = "alert_on_high_cost" | "alert_on_errors" | "alert_on_latency" | "daily_digest" | "weekly_report";

function settingBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : value === 0 || value === 1 ? Boolean(value) : fallback;
}

function settingNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function settingString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace, refreshUser, setCurrentWorkspace, session, user, isLoading } = useAuth();
  const { toast } = useToast();
  const previousWorkspaceId = useRef<string | null>(null);

  const [plainApiKey, setPlainApiKey] = useState<string | null>(null);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [budget, setBudget] = useState("100");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notificationEmailError, setNotificationEmailError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [lastTestEmailSent, setLastTestEmailSent] = useState<number | null>(null);
  const [alertHighCost, setAlertHighCost] = useState(true);
  const [alertErrors, setAlertErrors] = useState(true);
  const [alertLatency, setAlertLatency] = useState(false);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [thresholdDraft, setThresholdDraft] = useState("50");
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [latencyThresholdDraft, setLatencyThresholdDraft] = useState("2000");
  const [latencyThresholdError, setLatencyThresholdError] = useState<string | null>(null);
  const [dailyDigestTime, setDailyDigestTime] = useState("09:00");
  const [digestTimezone, setDigestTimezone] = useState("UTC");
  const [weeklyReportDay, setWeeklyReportDay] = useState("Monday");
  const [weeklyReportTime, setWeeklyReportTime] = useState("08:00");

  const [savingMeta, setSavingMeta] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [savingEmailSettings, setSavingEmailSettings] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [keyLabel, setKeyLabel] = useState("Production OpenClaw");
  const [keyType, setKeyType] = useState<ApiKeyType>("OPENCLAW");
  const [keyExpiresAt, setKeyExpiresAt] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramBotTokenError, setTelegramBotTokenError] = useState<string | null>(null);
  const [verifyingTelegram, setVerifyingTelegram] = useState(false);
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [regeneratingTelegramKey, setRegeneratingTelegramKey] = useState(false);
  const [disconnectingTelegram, setDisconnectingTelegram] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usageQuery = useQuery({
    queryKey: ["workspace-usage", currentWorkspace?.id],
    queryFn: () => fetchWorkspaceUsage(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
    staleTime: 5_000,
    retry: 1,
  });

  const apiKeysQuery = useQuery({
    queryKey: ["workspace-api-keys", currentWorkspace?.id],
    queryFn: () => fetchWorkspaceApiKeys(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
    staleTime: 5_000,
    retry: 1,
  });

  const telegramQuery = useQuery({
    queryKey: ["telegram-integration", currentWorkspace?.id],
    queryFn: () => fetchTelegramIntegrationStatus(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
    staleTime: 5_000,
    retry: 1,
  });

  useEffect(() => {
    if (!currentWorkspace) return;

    const workspaceChanged = previousWorkspaceId.current !== currentWorkspace.id;
    previousWorkspaceId.current = currentWorkspace.id;

    setName(currentWorkspace.name);
    setBudget(String(currentWorkspace.monthly_budget));
    setWebhookUrl(currentWorkspace.webhook_url ?? "");
    setNotificationEmail(settingString(currentWorkspace.settings?.notification_email, user?.email ?? ""));
    setEmailVerified(settingBool(currentWorkspace.settings?.email_verified, Boolean(currentWorkspace.settings?.notification_email || user?.email)));
    setLastTestEmailSent(settingNumber(currentWorkspace.settings?.last_test_email_sent, 0) || null);
    setAlertHighCost(settingBool(currentWorkspace.settings?.alert_on_high_cost, true));
    setAlertErrors(settingBool(currentWorkspace.settings?.alert_on_errors, true));
    setAlertLatency(settingBool(currentWorkspace.settings?.alert_on_latency, false));
    setDailyDigest(settingBool(currentWorkspace.settings?.daily_digest, false));
    setWeeklyReport(settingBool(currentWorkspace.settings?.weekly_report, true));
    setThresholdDraft(String(settingNumber(currentWorkspace.settings?.alert_cost_threshold, 50)));
    setLatencyThresholdDraft(String(settingNumber(currentWorkspace.settings?.latency_threshold_ms, 2000)));
    setDailyDigestTime(settingString(currentWorkspace.settings?.daily_digest_time, "09:00"));
    setDigestTimezone(settingString(currentWorkspace.settings?.digest_timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));
    setWeeklyReportDay(settingString(currentWorkspace.settings?.weekly_report_day, "Monday"));
    setWeeklyReportTime(settingString(currentWorkspace.settings?.weekly_report_time, "08:00"));
    setNameError(null);
    setBudgetError(null);
    setWebhookError(null);
    setNotificationEmailError(null);
    setThresholdError(null);
    setLatencyThresholdError(null);
    setError(null);

    if (workspaceChanged) {
      setPlainApiKey(currentWorkspace.apiKey?.value ?? null);
      setTelegramBotToken("");
      setTelegramBotTokenError(null);
      setDeleteConfirmation("");
      setRotateDialogOpen(false);
      setDeleteDialogOpen(false);
    }
  }, [currentWorkspace, user?.email]);

  const syncWorkspaceState = async () => {
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
    await queryClient.invalidateQueries({ queryKey: ["telemetry-rows"] });
    await queryClient.invalidateQueries({ queryKey: ["request-log"] });
    await queryClient.invalidateQueries({ queryKey: ["health"] });
    await queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
    await queryClient.invalidateQueries({ queryKey: ["workspace-api-keys"] });
    await queryClient.invalidateQueries({ queryKey: ["telegram-integration"] });
  };

  const alertDraft = useMemo(
    () => ({
      alert_on_high_cost: alertHighCost,
      alert_on_errors: alertErrors,
      alert_on_latency: alertLatency,
      daily_digest: dailyDigest,
      weekly_report: weeklyReport,
      alert_cost_threshold: Number(thresholdDraft),
      latency_threshold_ms: Number(latencyThresholdDraft),
      daily_digest_time: dailyDigestTime,
      digest_timezone: digestTimezone.trim(),
      weekly_report_day: weeklyReportDay,
      weekly_report_time: weeklyReportTime,
    }),
    [alertErrors, alertHighCost, alertLatency, dailyDigest, dailyDigestTime, digestTimezone, latencyThresholdDraft, thresholdDraft, weeklyReport, weeklyReportDay, weeklyReportTime]
  );

  const hasMetaChanges = !!currentWorkspace && (
    name.trim() !== currentWorkspace.name ||
    Number(budget) !== Number(currentWorkspace.monthly_budget) ||
    webhookUrl.trim() !== (currentWorkspace.webhook_url ?? "")
  );

  const hasAlertChanges = !!currentWorkspace && (
    alertHighCost !== settingBool(currentWorkspace.settings?.alert_on_high_cost, true) ||
    alertErrors !== settingBool(currentWorkspace.settings?.alert_on_errors, true) ||
    alertLatency !== settingBool(currentWorkspace.settings?.alert_on_latency, false) ||
    dailyDigest !== settingBool(currentWorkspace.settings?.daily_digest, false) ||
    weeklyReport !== settingBool(currentWorkspace.settings?.weekly_report, true) ||
    Number(thresholdDraft) !== settingNumber(currentWorkspace.settings?.alert_cost_threshold, 50) ||
    Number(latencyThresholdDraft) !== settingNumber(currentWorkspace.settings?.latency_threshold_ms, 2000) ||
    dailyDigestTime !== settingString(currentWorkspace.settings?.daily_digest_time, "09:00") ||
    digestTimezone.trim() !== settingString(currentWorkspace.settings?.digest_timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") ||
    weeklyReportDay !== settingString(currentWorkspace.settings?.weekly_report_day, "Monday") ||
    weeklyReportTime !== settingString(currentWorkspace.settings?.weekly_report_time, "08:00")
  );

  const hasUnsavedChanges = hasMetaChanges || hasAlertChanges;

  const resetDrafts = () => {
    if (!currentWorkspace) return;
    setName(currentWorkspace.name);
    setBudget(String(currentWorkspace.monthly_budget));
    setWebhookUrl(currentWorkspace.webhook_url ?? "");
    setAlertHighCost(settingBool(currentWorkspace.settings?.alert_on_high_cost, true));
    setAlertErrors(settingBool(currentWorkspace.settings?.alert_on_errors, true));
    setAlertLatency(settingBool(currentWorkspace.settings?.alert_on_latency, false));
    setDailyDigest(settingBool(currentWorkspace.settings?.daily_digest, false));
    setWeeklyReport(settingBool(currentWorkspace.settings?.weekly_report, true));
    setThresholdDraft(String(settingNumber(currentWorkspace.settings?.alert_cost_threshold, 50)));
    setLatencyThresholdDraft(String(settingNumber(currentWorkspace.settings?.latency_threshold_ms, 2000)));
    setDailyDigestTime(settingString(currentWorkspace.settings?.daily_digest_time, "09:00"));
    setDigestTimezone(settingString(currentWorkspace.settings?.digest_timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));
    setWeeklyReportDay(settingString(currentWorkspace.settings?.weekly_report_day, "Monday"));
    setWeeklyReportTime(settingString(currentWorkspace.settings?.weekly_report_time, "08:00"));
    setNameError(null);
    setBudgetError(null);
    setWebhookError(null);
    setThresholdError(null);
    setLatencyThresholdError(null);
    setError(null);
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
      const data = await rotateWorkspaceApiKey(currentWorkspace.id, currentWorkspace.name);
      setPlainApiKey(data.apiKey);
      setRotateDialogOpen(false);
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["workspace-api-keys", currentWorkspace.id] });
      toast({ title: "API key rotated", description: "Existing integrations must use the new key." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rotate API key";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setRotatingKey(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!currentWorkspace) return;

    const expiresAt = keyExpiresAt.trim()
      ? new Date(`${keyExpiresAt.trim()}T23:59:59.999`).getTime()
      : null;
    if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
      toast({ title: "Invalid expiration", description: "Use a future date in YYYY-MM-DD format.", variant: "destructive" });
      return;
    }

    try {
      setCreatingKey(true);
      const created = await createWorkspaceApiKey(currentWorkspace.id, {
        label: keyLabel.trim() || `${keyType} key`,
        type: keyType,
        expires_at: expiresAt,
      });
      setPlainApiKey(created.apiKey);
      await queryClient.invalidateQueries({ queryKey: ["workspace-api-keys", currentWorkspace.id] });
      toast({ title: "API key created", description: "Copy the secret now. It will not be shown again." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create API key";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!currentWorkspace) return;
    try {
      setRevokingKey(keyId);
      await revokeWorkspaceApiKey(currentWorkspace.id, keyId);
      await queryClient.invalidateQueries({ queryKey: ["workspace-api-keys", currentWorkspace.id] });
      toast({ title: "API key revoked", description: "Requests using this key will now fail." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to revoke API key";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setRevokingKey(null);
    }
  };

  const handleVerifyTelegram = async () => {
    if (!currentWorkspace) return;
    try {
      setVerifyingTelegram(true);
      setTelegramBotTokenError(null);
      const result = await verifyTelegramBot(currentWorkspace.id, telegramBotToken);
      toast({ title: "Telegram bot verified", description: `@${result.bot.username} is ready to connect.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify Telegram bot";
      setTelegramBotTokenError(message);
      toast({ title: "Telegram verification failed", description: message, variant: "destructive" });
    } finally {
      setVerifyingTelegram(false);
    }
  };

  const handleConnectTelegram = async () => {
    if (!currentWorkspace) return;
    try {
      setConnectingTelegram(true);
      setTelegramBotTokenError(null);
      const result = await connectTelegramIntegration(currentWorkspace.id, telegramBotToken);
      setTelegramBotToken("");
      await queryClient.invalidateQueries({ queryKey: ["telegram-integration", currentWorkspace.id] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-api-keys", currentWorkspace.id] });
      toast({ title: "Telegram connected", description: `@${result.integration.telegram_bot_username} is connected to this workspace.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect Telegram";
      setTelegramBotTokenError(message);
      toast({ title: "Telegram connection failed", description: message, variant: "destructive" });
    } finally {
      setConnectingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!currentWorkspace) return;
    try {
      setTestingTelegram(true);
      await testTelegramIntegration(currentWorkspace.id);
      await queryClient.invalidateQueries({ queryKey: ["telegram-integration", currentWorkspace.id] });
      toast({ title: "Telegram test succeeded", description: "Stored credentials verified." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to test Telegram";
      toast({ title: "Telegram test failed", description: message, variant: "destructive" });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleRegenerateTelegramKey = async () => {
    if (!currentWorkspace) return;
    try {
      setRegeneratingTelegramKey(true);
      await regenerateTelegramOpenClawKey(currentWorkspace.id);
      await queryClient.invalidateQueries({ queryKey: ["telegram-integration", currentWorkspace.id] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-api-keys", currentWorkspace.id] });
      toast({ title: "OpenClaw key regenerated", description: "Telegram will use the new encrypted workspace key." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to regenerate OpenClaw key";
      toast({ title: "Key regeneration failed", description: message, variant: "destructive" });
    } finally {
      setRegeneratingTelegramKey(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!currentWorkspace) return;
    try {
      setDisconnectingTelegram(true);
      await disconnectTelegramIntegration(currentWorkspace.id);
      await queryClient.invalidateQueries({ queryKey: ["telegram-integration", currentWorkspace.id] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-api-keys", currentWorkspace.id] });
      toast({ title: "Telegram disconnected", description: "The integration key was revoked." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect Telegram";
      toast({ title: "Disconnect failed", description: message, variant: "destructive" });
    } finally {
      setDisconnectingTelegram(false);
    }
  };

  const handleAlertUpdate = async (settingKey: AlertSettingKey, nextValue: boolean) => {
    if (settingKey === "alert_on_high_cost") {
      setAlertHighCost(nextValue);
    } else if (settingKey === "alert_on_errors") {
      setAlertErrors(nextValue);
    } else if (settingKey === "alert_on_latency") {
      setAlertLatency(nextValue);
    } else if (settingKey === "daily_digest") {
      setDailyDigest(nextValue);
    } else if (settingKey === "weekly_report") {
      setWeeklyReport(nextValue);
    }
  };

  const handleThresholdInputChange = (value: string) => {
    setThresholdDraft(value);
    setThresholdError(null);
  };

  const handleLatencyThresholdInputChange = (value: string) => {
    setLatencyThresholdDraft(value);
    setLatencyThresholdError(null);
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

  const handleSaveAlerts = async () => {
    if (!currentWorkspace) return false;

    const thresholdValidation = validateAlertThreshold(thresholdDraft);
    const latencyValidation = validateLatencyThreshold(latencyThresholdDraft);
    const dailyTimeValidation = validateTimeValue(dailyDigestTime, "Daily digest time");
    const weeklyTimeValidation = validateTimeValue(weeklyReportTime, "Weekly report time");
    const timezoneValidation = validateTimezone(digestTimezone);
    setThresholdError(thresholdValidation.valid ? null : thresholdValidation.error || "Invalid threshold");
    setLatencyThresholdError(latencyValidation.valid ? null : latencyValidation.error || "Invalid latency threshold");
    if (!thresholdValidation.valid || !latencyValidation.valid || !dailyTimeValidation.valid || !weeklyTimeValidation.valid || !timezoneValidation.valid) {
      const message = dailyTimeValidation.error || weeklyTimeValidation.error || timezoneValidation.error || "Invalid alert settings";
      toast({ title: "Check alert settings", description: message, variant: "destructive" });
      return false;
    }

    try {
      setSavingAlerts(true);
      await updateWorkspaceSettings(currentWorkspace.id, alertDraft);
      await syncWorkspaceState();
      toast({ title: "Alert settings saved", description: "Notification preferences updated" });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update alert settings";
      toast({ title: "Error", description: message, variant: "destructive" });
      return false;
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!currentWorkspace) return;

    const trimmedEmail = notificationEmail.trim().toLowerCase();
    const validation = trimmedEmail ? validateNotificationEmail(trimmedEmail) : { valid: true };
    setNotificationEmailError(validation.valid ? null : validation.error || "Invalid recipient email");
    if (!validation.valid) return;

    try {
      setSavingEmailSettings(true);
      const settings = await updateWorkspaceSettings(currentWorkspace.id, { notification_email: trimmedEmail || null });
      setNotificationEmail(String(settings.notification_email ?? ""));
      setEmailVerified(settingBool(settings.email_verified, false));
      setLastTestEmailSent(settingNumber(settings.last_test_email_sent, 0) || null);
      await syncWorkspaceState();
      toast({
        title: trimmedEmail ? "Recipient saved" : "Recipient cleared",
        description: settingBool(settings.email_verified, false)
          ? "Verified delivery remains active for this recipient."
          : trimmedEmail ? "Send a test email to verify delivery before scheduled notifications run." : "Scheduled emails are disabled until a recipient is configured.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save recipient email";
      setNotificationEmailError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingEmailSettings(false);
    }
  };

  const handleTestEmail = async () => {
    if (!currentWorkspace || testingEmail) return;

    const trimmedEmail = notificationEmail.trim().toLowerCase();
    const validation = validateNotificationEmail(trimmedEmail);
    setNotificationEmailError(validation.valid ? null : validation.error || "Invalid recipient email");
    if (!validation.valid) return;

    try {
      setTestingEmail(true);
      const result = await sendTestEmail(currentWorkspace.id, trimmedEmail);
      setNotificationEmail(result.recipient);
      setEmailVerified(true);
      setLastTestEmailSent(result.sentAt);
      await syncWorkspaceState();
      toast({
        title: "Test email sent",
        description: result.email.simulated ? "Delivery was simulated because Resend is not configured in this environment." : `Sent to ${result.recipient}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send test email";
      setEmailVerified(false);
      setNotificationEmailError(message);
      toast({ title: "Test email failed", description: message, variant: "destructive" });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSendDailyDigest = async () => {
    if (!currentWorkspace) return;
    const saved = hasAlertChanges ? await handleSaveAlerts() : true;
    if (!saved) return;

    try {
      setSavingAlerts(true);
      const result = await sendDailyDigest(currentWorkspace.id);
      await syncWorkspaceState();
      toast({ title: "Daily digest sent", description: `Sent to ${result.recipient}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send daily digest";
      toast({ title: "Daily digest failed", description: message, variant: "destructive" });
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleSendWeeklyReport = async () => {
    if (!currentWorkspace) return;
    const saved = hasAlertChanges ? await handleSaveAlerts() : true;
    if (!saved) return;

    try {
      setSavingAlerts(true);
      const result = await sendWeeklyReport(currentWorkspace.id);
      await syncWorkspaceState();
      toast({ title: "Weekly report sent", description: `Sent to ${result.recipient}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send weekly report";
      toast({ title: "Weekly report failed", description: message, variant: "destructive" });
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

  const handleTestWebhook = async () => {
    if (!currentWorkspace) return;

    const validation = validateWebhookUrl(webhookUrl);
    if (!webhookUrl.trim() || !validation.valid) {
      setWebhookError(validation.error || "Webhook URL is required");
      return;
    }

    try {
      setTestingWebhook(true);
      setWebhookError(null);
      const result = await testWorkspaceWebhook(currentWorkspace.id, webhookUrl.trim());
      await syncWorkspaceState();
      toast({
        title: result.success ? "Webhook test succeeded" : "Webhook test failed",
        description: result.responseCode
          ? `HTTP ${result.responseCode} in ${result.responseTimeMs} ms`
          : result.error || `Completed in ${result.responseTimeMs} ms`,
        variant: result.success ? "default" : "destructive",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to test webhook";
      setWebhookError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setTestingWebhook(false);
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
    const thresholdValidation = validateAlertThreshold(thresholdDraft);
    const latencyValidation = validateLatencyThreshold(latencyThresholdDraft);
    const dailyTimeValidation = validateTimeValue(dailyDigestTime, "Daily digest time");
    const weeklyTimeValidation = validateTimeValue(weeklyReportTime, "Weekly report time");
    const timezoneValidation = validateTimezone(digestTimezone);

    setNameError(nameValidation.valid ? null : nameValidation.error || "Invalid name");
    setBudgetError(budgetValidation.valid ? null : budgetValidation.error || "Invalid budget");
    setWebhookError(webhookValidation.valid ? null : webhookValidation.error || "Invalid webhook URL");
    setThresholdError(thresholdValidation.valid ? null : thresholdValidation.error || "Invalid threshold");
    setLatencyThresholdError(latencyValidation.valid ? null : latencyValidation.error || "Invalid latency threshold");

    if (!nameValidation.valid || !budgetValidation.valid || !webhookValidation.valid || !thresholdValidation.valid || !latencyValidation.valid || !dailyTimeValidation.valid || !weeklyTimeValidation.valid || !timezoneValidation.valid) {
      const message = dailyTimeValidation.error || weeklyTimeValidation.error || timezoneValidation.error;
      if (message) toast({ title: "Check alert settings", description: message, variant: "destructive" });
      return;
    }

    try {
      setSavingMeta(true);
      setSavingAlerts(true);
      setError(null);
      const trimmedWebhook = webhookUrl.trim();
      if (hasMetaChanges) {
        await updateWorkspaceMeta(currentWorkspace.id, {
          name: name.trim(),
          monthly_budget: Number(budget),
          webhook_url: trimmedWebhook || null,
        });
      }
      if (hasAlertChanges) {
        await updateWorkspaceSettings(currentWorkspace.id, alertDraft);
      }
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
      setSavingAlerts(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;

    try {
      setDeletingWorkspace(true);
      setError(null);
      await deleteWorkspaceById(currentWorkspace.id, deleteConfirmation.trim());
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
        {isLoading ? (
          <div className="max-w-2xl space-y-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="border p-6 text-center text-sm text-muted-foreground">No workspace selected</div>
        )}
      </AppLayout>
    );
  }

  const sliderValue = (() => {
    const parsed = Number(thresholdDraft);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
      ? parsed
      : settingNumber(currentWorkspace.settings?.alert_cost_threshold, 50);
  })();
  const deleteEnabled = deleteConfirmation.trim() === currentWorkspace.name;

  return (
    <AppLayout title="Settings" meta={`workspace | ${currentWorkspace.name}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSaveSettings();
        }}
        className="max-w-3xl space-y-8 pb-24"
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <SettingsApiKeySection
          workspace={currentWorkspace}
          keys={apiKeysQuery.data ?? []}
          plainApiKey={plainApiKey}
          isLoading={apiKeysQuery.isLoading}
          isCreating={creatingKey}
          isRotating={rotatingKey}
          isRevoking={revokingKey}
          draftLabel={keyLabel}
          draftType={keyType}
          draftExpiresAt={keyExpiresAt}
          onDraftLabelChange={setKeyLabel}
          onDraftTypeChange={setKeyType}
          onDraftExpiresAtChange={setKeyExpiresAt}
          onCreate={() => void handleCreateApiKey()}
          onCopy={() => void handleCopyApiKey()}
          onRequestRotate={() => setRotateDialogOpen(true)}
          onRevoke={(keyId) => void handleRevokeApiKey(keyId)}
        />

        <SettingsTelegramSection
          integration={telegramQuery.data}
          botToken={telegramBotToken}
          botTokenError={telegramBotTokenError}
          isLoading={telegramQuery.isLoading}
          isVerifying={verifyingTelegram}
          isConnecting={connectingTelegram}
          isTesting={testingTelegram}
          isRegenerating={regeneratingTelegramKey}
          isDisconnecting={disconnectingTelegram}
          onBotTokenChange={(value) => {
            setTelegramBotToken(value);
            setTelegramBotTokenError(null);
          }}
          onVerify={() => void handleVerifyTelegram()}
          onConnect={() => void handleConnectTelegram()}
          onTest={() => void handleTestTelegram()}
          onRegenerate={() => void handleRegenerateTelegramKey()}
          onDisconnect={() => void handleDisconnectTelegram()}
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

        <SettingsEmailNotificationsSection
          value={notificationEmail}
          error={notificationEmailError}
          verified={emailVerified}
          lastTestAt={lastTestEmailSent}
          isSaving={savingEmailSettings}
          isTesting={testingEmail}
          onChange={(value) => {
            setNotificationEmail(value);
            setNotificationEmailError(null);
            setEmailVerified(value.trim().toLowerCase() === settingString(currentWorkspace.settings?.notification_email, "").toLowerCase()
              ? settingBool(currentWorkspace.settings?.email_verified, false)
              : false);
          }}
          onSave={() => void handleSaveEmailSettings()}
          onTest={() => void handleTestEmail()}
        />

        <SettingsAlertsSection
          alertHighCost={alertHighCost}
          alertErrors={alertErrors}
          alertLatency={alertLatency}
          dailyDigest={dailyDigest}
          weeklyReport={weeklyReport}
          thresholdDraft={thresholdDraft}
          latencyThresholdDraft={latencyThresholdDraft}
          dailyDigestTime={dailyDigestTime}
          digestTimezone={digestTimezone}
          weeklyReportDay={weeklyReportDay}
          weeklyReportTime={weeklyReportTime}
          recipientEmail={notificationEmail}
          recipientVerified={emailVerified}
          sliderValue={sliderValue}
          error={thresholdError}
          latencyError={latencyThresholdError}
          isSaving={savingAlerts}
          onToggleHighCost={(enabled) => void handleAlertUpdate("alert_on_high_cost", enabled)}
          onToggleErrors={(enabled) => void handleAlertUpdate("alert_on_errors", enabled)}
          onToggleLatency={(enabled) => void handleAlertUpdate("alert_on_latency", enabled)}
          onToggleDailyDigest={(enabled) => void handleAlertUpdate("daily_digest", enabled)}
          onToggleWeeklyReport={(enabled) => void handleAlertUpdate("weekly_report", enabled)}
          onThresholdInputChange={handleThresholdInputChange}
          onLatencyThresholdInputChange={handleLatencyThresholdInputChange}
          onDailyDigestTimeChange={setDailyDigestTime}
          onDigestTimezoneChange={setDigestTimezone}
          onWeeklyReportDayChange={setWeeklyReportDay}
          onWeeklyReportTimeChange={setWeeklyReportTime}
          onThresholdSliderChange={handleThresholdSliderChange}
          onSaveThreshold={() => void handleSaveThreshold()}
          onSaveAlerts={() => void handleSaveAlerts()}
          onSendDailyDigest={() => void handleSendDailyDigest()}
          onSendWeeklyReport={() => void handleSendWeeklyReport()}
        />

        <SettingsWebhookSection
          value={webhookUrl}
          error={webhookError}
          isSaving={savingMeta}
          isTesting={testingWebhook}
          lastTestAt={settingNumber(currentWorkspace.settings?.webhook_last_test_at, 0) || null}
          lastStatus={typeof currentWorkspace.settings?.webhook_last_status === "string" ? currentWorkspace.settings.webhook_last_status : null}
          lastResponseCode={settingNumber(currentWorkspace.settings?.webhook_last_response_code, 0) || null}
          lastResponseTimeMs={settingNumber(currentWorkspace.settings?.webhook_last_response_time_ms, 0) || null}
          onChange={(value) => {
            setWebhookUrl(value);
            setWebhookError(null);
          }}
          onSave={() => void handleSaveWebhook()}
          onTest={() => void handleTestWebhook()}
        />

        <SettingsUsageSection
          workspace={currentWorkspace}
          usage={usageQuery.data}
          isLoading={usageQuery.isLoading}
          error={usageQuery.error instanceof Error ? usageQuery.error.message : null}
        />

        <SettingsSecuritySection user={user} session={session} workspace={currentWorkspace} />

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={savingMeta || savingAlerts || !hasUnsavedChanges}>
                {savingMeta || savingAlerts ? "Saving..." : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={resetDrafts} disabled={savingMeta || savingAlerts || !hasUnsavedChanges}>
                Cancel
              </Button>
            </div>
          </div>
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
            Type <span className="font-mono text-foreground">{currentWorkspace.name}</span> to confirm.
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

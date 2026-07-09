import { getDatabase } from "../db/database";
import { getConfig } from "../config/env";
import { getWorkspace, getWorkspaceSettings, updateWorkspaceSettings, type Workspace, type WorkspaceSettings } from "./authService";
import { buildAnalyticsSnapshot } from "./analyticsService";
import { generateForecast } from "./forecastService";
import { generateRecommendations } from "./recommendationService";
import { exportReport } from "./reportService";
import { getCurrentMonthSpend } from "./telemetryRepository";
import { sendEmail, type SendEmailResult } from "./emailService";
import { renderTokenWatcherEmail, type EmailMetric, type EmailTable } from "./emailTemplates";

type NotificationKind = "test" | "high-cost" | "error" | "latency" | "daily-digest" | "weekly-report";

export interface NotificationSendResult {
  ok: true;
  kind: NotificationKind;
  recipient: string;
  email: SendEmailResult;
  sentAt: number;
}

interface NotificationContext {
  workspace: Workspace;
  settings: WorkspaceSettings;
  recipient: string;
}

interface ResolveNotificationContextOptions {
  requireVerified?: boolean;
}

const ALERT_THROTTLE_MS = 60 * 60 * 1000;
const SCHEDULED_SEND_RETRIES = 2;
const SCHEDULED_SEND_RETRY_DELAY_MS = 2_000;
let scheduler: ReturnType<typeof setInterval> | null = null;
let schedulerRunInProgress = false;

export function isValidNotificationEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function sendTestNotification(workspaceId: string, userId: string, email?: string): Promise<NotificationSendResult> {
  const context = await resolveNotificationContext(workspaceId, userId, email, { requireVerified: false });
  const [snapshot, forecast] = await Promise.all([
    buildAnalyticsSnapshot(workspaceId),
    generateForecast(workspaceId),
  ]);
  const sentAt = Date.now();
  const html = renderTokenWatcherEmail({
    eyebrow: "Test Notification",
    title: "TokenWatcher test notification",
    intro: "This confirms TokenWatcher email notifications are configured for this workspace.",
    metadata: buildMetadata(context.workspace, sentAt),
    metrics: [
      { label: "Current spend", value: money(snapshot.overview.spendToday) },
      { label: "Current requests", value: number(snapshot.overview.requestsToday) },
      { label: "Current models", value: number(snapshot.models.length) },
      { label: "Monthly forecast", value: money(forecast.predictedSpend.monthly) },
      { label: "Timestamp", value: new Date(sentAt).toISOString() },
    ],
  });
  const emailResult = await sendEmail({ to: context.recipient, subject: "TokenWatcher - Test Notification", html });
  await updateWorkspaceSettings(workspaceId, {
    notification_email: context.recipient,
    email_verified: true,
    last_test_email_sent: sentAt,
  });
  return { ok: true, kind: "test", recipient: context.recipient, email: emailResult, sentAt };
}

export async function sendDailyDigest(workspaceId: string, userId?: string): Promise<NotificationSendResult> {
  const context = await resolveNotificationContext(workspaceId, userId);
  if (!context.settings.daily_digest) {
    throw new Error("Daily digest is disabled for this workspace.");
  }
  const [snapshot, forecast, recommendations] = await Promise.all([
    buildAnalyticsSnapshot(workspaceId),
    generateForecast(workspaceId),
    generateRecommendations(workspaceId),
  ]);
  const avgLatency = weightedAverage(snapshot.endpoints.map((row) => ({ value: row.avg_latency_ms, weight: row.requests })));
  const sentAt = Date.now();
  const html = renderTokenWatcherEmail({
    eyebrow: "Daily Digest",
    title: "Daily AI infrastructure digest",
    intro: "A compact operating summary for spend, traffic, latency, errors, and near-term forecast.",
    metadata: buildMetadata(context.workspace, sentAt),
    metrics: [
      { label: "Daily spend", value: money(snapshot.overview.spendToday) },
      { label: "Total requests", value: number(snapshot.overview.requestsToday) },
      { label: "Average latency", value: latency(avgLatency) },
      { label: "Error rate", value: percent(snapshot.overview.errorRate) },
      { label: "Forecast", value: money(forecast.predictedSpend.monthly) },
    ],
    tables: [
      table("Top models", ["Model", "Provider", "Requests", "Cost"], snapshot.models.slice(0, 5).map((row) => [row.model, row.provider, row.requests, money(row.cost_usd)])),
      table("Top endpoints", ["Endpoint", "Requests", "Latency", "Cost"], snapshot.endpoints.slice(0, 5).map((row) => [row.route, row.requests, latency(row.avg_latency_ms), money(row.cost_usd)])),
    ],
    recommendations: recommendations.slice(0, 4).map((item) => ({ title: item.title, detail: item.description })),
  });
  const emailResult = await sendEmail({ to: context.recipient, subject: "TokenWatcher - Daily Digest", html });
  await updateWorkspaceSettings(workspaceId, { last_digest_sent: sentAt });
  return { ok: true, kind: "daily-digest", recipient: context.recipient, email: emailResult, sentAt };
}

export async function sendWeeklyExecutiveReport(workspaceId: string, userId?: string): Promise<NotificationSendResult> {
  const context = await resolveNotificationContext(workspaceId, userId);
  if (!context.settings.weekly_report) {
    throw new Error("Weekly report is disabled for this workspace.");
  }
  const report = await exportReport(workspaceId, "executive", "json");
  const pdf = await exportReport(workspaceId, "executive", "pdf");
  const parsed = JSON.parse(String(report.body));
  const sentAt = Date.now();
  const html = renderTokenWatcherEmail({
    eyebrow: "Weekly Executive Report",
    title: "Weekly AI operations report",
    intro: parsed.summary ?? "Weekly spend, provider health, model usage, endpoint ranking, forecast, and recommendations.",
    metadata: buildMetadata(context.workspace, sentAt),
    metrics: [
      { label: "Weekly spend", value: money(parsed.costAnalysis?.totalSpend ?? 0) },
      { label: "Budget health", value: `${Math.round((parsed.costAnalysis?.budgetUtilization ?? 0) * 100)}% used` },
      { label: "Efficiency score", value: String(parsed.efficiencyScore?.overallScore ?? "n/a") },
      { label: "Monthly forecast", value: money(parsed.forecast?.predictedSpend?.monthly ?? 0) },
    ],
    tables: [
      table("Provider comparison", ["Provider", "Requests", "Spend", "Share"], (parsed.providerAnalysis?.providers ?? []).slice(0, 5).map((row: any) => [row.provider, row.requests, money(row.spend), percent(row.share)])),
      table("Model comparison", ["Model", "Provider", "Requests", "Cost"], (parsed.modelAnalysis?.models ?? []).slice(0, 5).map((row: any) => [row.model, row.provider, row.requests, money(row.cost_usd)])),
      table("Top endpoints", ["Endpoint", "Requests", "Latency", "Cost"], (parsed.endpointAnalysis?.endpoints ?? []).slice(0, 5).map((row: any) => [row.route, row.requests, latency(row.avg_latency_ms), money(row.cost_usd)])),
    ],
    recommendations: (parsed.recommendations ?? []).slice(0, 5).map((item: any) => ({ title: item.title, detail: item.description })),
  });
  const emailResult = await sendEmail({
    to: context.recipient,
    subject: "TokenWatcher - Weekly Executive Report",
    html,
    attachments: [{ filename: pdf.filename, content: pdf.body, contentType: pdf.contentType }],
  });
  await updateWorkspaceSettings(workspaceId, { last_weekly_report_sent: sentAt });
  return { ok: true, kind: "weekly-report", recipient: context.recipient, email: emailResult, sentAt };
}

export async function evaluateWorkspaceAlerts(workspaceId: string): Promise<void> {
  try {
    const settings = await getWorkspaceSettings(workspaceId);
    if (!settings || (!settings.alert_on_high_cost && !settings.alert_on_errors && !settings.alert_on_latency)) {
      return;
    }
    if (!settings.email_verified || !isValidNotificationEmail(settings.notification_email ?? "")) {
      return;
    }
    const context = await resolveNotificationContext(workspaceId);
    const [snapshot, forecast, recommendations, currentMonthSpend] = await Promise.all([
      buildAnalyticsSnapshot(workspaceId),
      generateForecast(workspaceId),
      generateRecommendations(workspaceId),
      getCurrentMonthSpend(workspaceId),
    ]);
    const now = Date.now();
    const topModel = snapshot.models[0];
    const topEndpoint = snapshot.endpoints[0];
    const thresholdSpend = context.workspace.monthly_budget * (context.settings.alert_cost_threshold / 100);

    if (context.settings.alert_on_high_cost && currentMonthSpend >= thresholdSpend && shouldSend(context.settings.last_high_cost_alert_sent, now)) {
      const html = renderTokenWatcherEmail({
        eyebrow: "Budget Alert",
        title: "Budget threshold exceeded",
        intro: "Workspace spend has crossed the configured monthly budget threshold.",
        metadata: buildMetadata(context.workspace, now),
        metrics: [
          { label: "Current spend", value: money(currentMonthSpend) },
          { label: "Budget", value: money(context.workspace.monthly_budget) },
          { label: "Threshold", value: `${context.settings.alert_cost_threshold}%` },
          { label: "Forecast", value: money(forecast.predictedSpend.monthly) },
          { label: "Largest model", value: topModel ? `${topModel.provider}/${topModel.model} (${money(topModel.cost_usd)})` : "No model data" },
          { label: "Largest endpoint", value: topEndpoint ? `${topEndpoint.route} (${money(topEndpoint.cost_usd)})` : "No endpoint data" },
        ],
        recommendations: recommendations.slice(0, 4).map((item) => ({ title: item.title, detail: item.description })),
      });
      await sendEmail({ to: context.recipient, subject: "TokenWatcher - Budget Alert", html });
      await updateWorkspaceSettings(workspaceId, { last_high_cost_alert_sent: now });
    }

    if (context.settings.alert_on_errors && snapshot.overview.requestsToday >= 10 && snapshot.overview.errorRate >= 0.05 && shouldSend(context.settings.last_error_alert_sent, now)) {
      const affectedEndpoint = [...snapshot.endpoints].sort((a, b) => b.requests - a.requests)[0];
      const affectedProvider = snapshot.models.find((row) => row.requests > 0)?.provider ?? "unknown";
      const html = renderTokenWatcherEmail({
        eyebrow: "Error Alert",
        title: "High request failure rate",
        intro: "TokenWatcher detected elevated request failures in current workspace traffic.",
        metadata: buildMetadata(context.workspace, now),
        metrics: [
          { label: "Error rate", value: percent(snapshot.overview.errorRate) },
          { label: "Affected endpoint", value: affectedEndpoint?.route ?? "unknown" },
          { label: "Affected provider", value: affectedProvider },
          { label: "Suggested action", value: "Inspect failed request drawer, retry policy, provider health, and timeout handling." },
        ],
      });
      await sendEmail({ to: context.recipient, subject: "TokenWatcher - Error Alert", html });
      await updateWorkspaceSettings(workspaceId, { last_error_alert_sent: now });
    }

    const avgLatency = weightedAverage(snapshot.endpoints.map((row) => ({ value: row.avg_latency_ms, weight: row.requests })));
    if (context.settings.alert_on_latency && avgLatency >= context.settings.latency_threshold_ms && shouldSend(context.settings.last_latency_alert_sent, now)) {
      const slowestEndpoint = [...snapshot.endpoints].sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)[0];
      const slowestProvider = [...snapshot.models].sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)[0]?.provider ?? "unknown";
      const html = renderTokenWatcherEmail({
        eyebrow: "Latency Alert",
        title: "Latency threshold exceeded",
        intro: "Average request latency is above the configured workspace threshold.",
        metadata: buildMetadata(context.workspace, now),
        metrics: [
          { label: "Current latency", value: latency(avgLatency) },
          { label: "Configured threshold", value: latency(context.settings.latency_threshold_ms) },
          { label: "Slowest endpoint", value: slowestEndpoint ? `${slowestEndpoint.route} (${latency(slowestEndpoint.avg_latency_ms)})` : "unknown" },
          { label: "Slowest provider", value: slowestProvider },
        ],
      });
      await sendEmail({ to: context.recipient, subject: "TokenWatcher - Latency Alert", html });
      await updateWorkspaceSettings(workspaceId, { last_latency_alert_sent: now });
    }
  } catch (error) {
    console.warn("[notifications:alerts]", error instanceof Error ? error.message : error);
  }
}

export function startNotificationScheduler(): void {
  if (scheduler) return;
  scheduler = setInterval(() => {
    void processDueScheduledNotifications();
  }, 60_000);
  void processDueScheduledNotifications();
}

export function stopNotificationScheduler(): void {
  if (!scheduler) return;
  clearInterval(scheduler);
  scheduler = null;
}

export async function processDueScheduledNotifications(): Promise<void> {
  if (schedulerRunInProgress) return;
  schedulerRunInProgress = true;
  const db = getDatabase();
  try {
    const rows = await db.prepare(`
      SELECT workspace_id FROM workspace_settings
      WHERE notification_email IS NOT NULL
        AND email_verified = true
        AND (daily_digest = true OR weekly_report = true);
    `).all<{ workspace_id: string }>();

    for (const row of rows) {
      const settings = await getWorkspaceSettings(row.workspace_id);
      if (!settings) continue;
      if (settings.daily_digest && isDailyDigestDue(settings)) {
        await sendScheduledWithRetry("daily", row.workspace_id, () => sendDailyDigest(row.workspace_id));
      }
      if (settings.weekly_report && isWeeklyReportDue(settings)) {
        await sendScheduledWithRetry("weekly", row.workspace_id, () => sendWeeklyExecutiveReport(row.workspace_id));
      }
    }
  } finally {
    schedulerRunInProgress = false;
  }
}

async function sendScheduledWithRetry(kind: "daily" | "weekly", workspaceId: string, send: () => Promise<NotificationSendResult>): Promise<void> {
  for (let attempt = 1; attempt <= SCHEDULED_SEND_RETRIES; attempt += 1) {
    try {
      await send();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[notifications:${kind}] workspace=${workspaceId} attempt=${attempt} ${message}`);
      if (attempt < SCHEDULED_SEND_RETRIES) {
        await delay(SCHEDULED_SEND_RETRY_DELAY_MS);
      }
    }
  }
}

async function resolveNotificationContext(
  workspaceId: string,
  userId?: string,
  overrideEmail?: string,
  options: ResolveNotificationContextOptions = {},
): Promise<NotificationContext> {
  const [workspace, settings] = await Promise.all([
    getWorkspace(workspaceId, userId),
    getWorkspaceSettings(workspaceId),
  ]);
  if (!workspace) throw new Error("Workspace not found");
  if (!settings) throw new Error("Workspace settings not found");
  const recipient = (overrideEmail ?? settings.notification_email ?? "").trim().toLowerCase();
  if (!isValidNotificationEmail(recipient)) {
    throw new Error("Enter a valid recipient email before sending notifications.");
  }
  if (options.requireVerified !== false && !settings.email_verified) {
    throw new Error("Verify the recipient email before sending scheduled notifications.");
  }
  return { workspace, settings, recipient };
}

function isDailyDigestDue(settings: WorkspaceSettings): boolean {
  if (!isConfiguredLocalTime(settings.daily_digest_time, settings.digest_timezone)) return false;
  return localDateKey(Date.now(), settings.digest_timezone) !== localDateKey(settings.last_digest_sent, settings.digest_timezone);
}

function isWeeklyReportDue(settings: WorkspaceSettings): boolean {
  if (!isConfiguredLocalTime(settings.weekly_report_time, settings.digest_timezone)) return false;
  if (localWeekday(Date.now(), settings.digest_timezone) !== settings.weekly_report_day) return false;
  return localWeekKey(Date.now(), settings.digest_timezone) !== localWeekKey(settings.last_weekly_report_sent, settings.digest_timezone);
}

function isConfiguredLocalTime(time: string, timezone: string): boolean {
  const parts = localParts(Date.now(), timezone);
  const [hour, minute] = time.split(":").map((value) => Number(value));
  return parts.hour === hour && parts.minute === minute;
}

function localParts(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    weekday: value("weekday"),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function localDateKey(timestamp: number | null, timezone: string): string | null {
  if (!timestamp) return null;
  const parts = localParts(timestamp, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localWeekKey(timestamp: number | null, timezone: string): string | null {
  if (!timestamp) return null;
  const parts = localParts(timestamp, timezone);
  const localDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const dayOffset = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - dayOffset);
  return localDate.toISOString().slice(0, 10);
}

function localWeekday(timestamp: number, timezone: string): string {
  return localParts(timestamp, timezone).weekday;
}

function shouldSend(lastSentAt: number | null, now: number): boolean {
  return !lastSentAt || now - lastSentAt >= ALERT_THROTTLE_MS;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMetadata(workspace: Workspace, timestamp: number): EmailMetric[] {
  return [
    { label: "Workspace", value: workspace.name },
    { label: "Workspace ID", value: workspace.id },
    { label: "Environment", value: getConfig().nodeEnv },
    { label: "Generated", value: new Date(timestamp).toISOString() },
  ];
}

function table(title: string, columns: string[], rows: Array<Array<string | number>>): EmailTable {
  return { title, columns, rows };
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const weight = values.reduce((sum, item) => sum + item.weight, 0);
  return weight > 0 ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / weight : 0;
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function number(value: number): string {
  return Number(value || 0).toLocaleString("en-US");
}

function percent(value: number): string {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function latency(value: number): string {
  return `${Math.round(Number(value || 0))} ms`;
}

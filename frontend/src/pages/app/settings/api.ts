import { authFetch } from "@/lib/api";

export async function parseApiError(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) return fallback;

  try {
    const body = JSON.parse(text);
    return String(body?.error || fallback);
  } catch {
    return text;
  }
}

export async function updateWorkspaceMeta(
  workspaceId: string,
  body: { name?: string; monthly_budget?: number; webhook_url?: string | null }
) {
  const response = await authFetch(`/api/workspaces/${workspaceId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to update workspace"));
  }

  return response.json();
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  body: {
    alert_on_high_cost?: boolean;
    alert_on_errors?: boolean;
    alert_on_latency?: boolean;
    daily_digest?: boolean;
    weekly_report?: boolean;
    alert_cost_threshold?: number;
    latency_threshold_ms?: number;
    notification_email?: string | null;
    daily_digest_time?: string;
    digest_timezone?: string;
    weekly_report_day?: string;
    weekly_report_time?: string;
  }
) {
  const response = await authFetch(`/api/workspaces/${workspaceId}/settings`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to update settings"));
  }

  return response.json();
}

export interface NotificationSendResponse {
  ok: true;
  kind: string;
  recipient: string;
  sentAt: number;
  email: { id: string | null; provider: "resend"; simulated: boolean };
}

export interface WorkspaceUsageResponse {
  telemetry_count: number;
  current_month_spend: number;
  api_version: string;
  sdk_version: string;
}

export interface WebhookTestResponse {
  success: boolean;
  status: "success" | "failure";
  responseCode: number | null;
  responseTimeMs: number;
  testedAt: number;
  error?: string;
}

export type ApiKeyType = "SDK" | "OPENCLAW" | "CI" | "READONLY" | "ADMIN" | "SERVICE";

export interface WorkspaceApiKey {
  id: string;
  workspace_id: string;
  label: string;
  type: ApiKeyType;
  permissions: string[];
  created_by: string | null;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
  revoked_at: number | null;
}

export async function rotateWorkspaceApiKey(
  workspaceId: string,
  confirmation: string
): Promise<{ apiKey: string; apiKeyMeta?: { id: string; created_at: number; revoked_at: number | null; last_rotated_at?: number | null } }> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/api-keys/regenerate`, {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to regenerate API key"));
  }

  return response.json();
}

export async function fetchWorkspaceApiKeys(workspaceId: string): Promise<WorkspaceApiKey[]> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/api-keys`);
  if (!response.ok) throw new Error(await parseApiError(response, "Failed to load API keys"));
  const body = await response.json();
  return body.apiKeys ?? [];
}

export async function createWorkspaceApiKey(
  workspaceId: string,
  body: { label: string; type: ApiKeyType; expires_at?: number | null }
): Promise<{ apiKey: string; apiKeyMeta: WorkspaceApiKey }> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/api-keys`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Failed to create API key"));
  return response.json();
}

export async function revokeWorkspaceApiKey(workspaceId: string, keyId: string): Promise<void> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/api-keys/${keyId}/revoke`, { method: "POST" });
  if (!response.ok) throw new Error(await parseApiError(response, "Failed to revoke API key"));
}

export async function deleteWorkspaceById(workspaceId: string, confirmation: string): Promise<void> {
  const response = await authFetch(`/api/workspaces/${workspaceId}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmation }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to delete workspace"));
  }
}

export async function fetchWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsageResponse> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/usage`);

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to load workspace usage"));
  }

  return response.json();
}

export async function testWorkspaceWebhook(workspaceId: string, url: string): Promise<WebhookTestResponse> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/webhook/test`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to test webhook"));
  }

  return response.json();
}

export async function sendTestEmail(workspaceId: string, email: string): Promise<NotificationSendResponse> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/notifications/test-email`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to send test email"));
  }

  return response.json();
}

export async function sendDailyDigest(workspaceId: string): Promise<NotificationSendResponse> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/notifications/send-daily-digest`, { method: "POST" });
  if (!response.ok) throw new Error(await parseApiError(response, "Failed to send daily digest"));
  return response.json();
}

export async function sendWeeklyReport(workspaceId: string): Promise<NotificationSendResponse> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/notifications/send-weekly-report`, { method: "POST" });
  if (!response.ok) throw new Error(await parseApiError(response, "Failed to send weekly report"));
  return response.json();
}

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
    alert_cost_threshold?: number;
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

export async function rotateWorkspaceApiKey(workspaceId: string): Promise<{ apiKey: string }> {
  const response = await authFetch(`/api/workspaces/${workspaceId}/api-keys/regenerate`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to regenerate API key"));
  }

  return response.json();
}

export async function deleteWorkspaceById(workspaceId: string): Promise<void> {
  const response = await authFetch(`/api/workspaces/${workspaceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to delete workspace"));
  }
}

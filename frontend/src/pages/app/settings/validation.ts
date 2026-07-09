export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateWorkspaceName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: "Workspace name is required" };
  if (trimmed.length > 100) return { valid: false, error: "Name must be 100 characters or less" };
  return { valid: true };
}

export function validateMonthlyBudget(budget: string): ValidationResult {
  if (!budget.trim()) return { valid: false, error: "Budget is required" };
  const num = Number(budget);
  if (!Number.isFinite(num)) return { valid: false, error: "Budget must be a valid number" };
  if (num < 0) return { valid: false, error: "Budget must be positive" };
  if (num > 999999) return { valid: false, error: "Budget must be less than 999,999" };
  return { valid: true };
}

export function validateWebhookUrl(url: string): ValidationResult {
  const trimmed = url.trim();
  if (!trimmed) return { valid: true };

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { valid: false, error: "Webhook URL must use http or https" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Enter a valid webhook URL" };
  }
}

export function validateNotificationEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: "Recipient email is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { valid: false, error: "Enter a valid recipient email" };
  return { valid: true };
}

export function validateTimeValue(value: string, label: string): ValidationResult {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())) return { valid: false, error: `${label} must use HH:MM format` };
  return { valid: true };
}

export function validateTimezone(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: "Timezone is required" };
  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return { valid: true };
  } catch {
    return { valid: false, error: "Enter a valid IANA timezone" };
  }
}

export function validateAlertThreshold(threshold: string): ValidationResult {
  if (!threshold.trim()) return { valid: false, error: "Threshold is required" };
  const num = Number(threshold);
  if (!Number.isFinite(num)) return { valid: false, error: "Threshold must be a valid number" };
  if (!Number.isInteger(num)) return { valid: false, error: "Threshold must be a whole number" };
  if (num < 1) return { valid: false, error: "Threshold must be at least 1%" };
  if (num > 100) return { valid: false, error: "Threshold must be 100% or less" };
  return { valid: true };
}

export function validateLatencyThreshold(threshold: string): ValidationResult {
  if (!threshold.trim()) return { valid: false, error: "Latency threshold is required" };
  const num = Number(threshold);
  if (!Number.isFinite(num)) return { valid: false, error: "Latency threshold must be a valid number" };
  if (!Number.isInteger(num)) return { valid: false, error: "Latency threshold must be a whole number" };
  if (num < 1) return { valid: false, error: "Latency threshold must be at least 1 ms" };
  if (num > 120000) return { valid: false, error: "Latency threshold must be 120000 ms or less" };
  return { valid: true };
}

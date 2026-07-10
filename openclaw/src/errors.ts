function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function formatUserFacingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (includesAny(normalized, ["401", "unauthorized", "invalid token", "login failed"])) {
    return "*Authentication Error*\nI couldn't authenticate with TokenWatcher. Please rotate the OpenClaw API key and restart the service.";
  }

  if (includesAny(normalized, ["403", "forbidden", "workspace id required", "workspace"])) {
    return "*Workspace Error*\nI couldn't find an accessible TokenWatcher workspace for this Telegram agent.";
  }

  if (includesAny(normalized, ["fetch failed", "econnrefused", "timed out", "failed with 500", "failed with 502", "failed with 503", "failed with 504"])) {
    return "*Backend Unavailable*\nTokenWatcher is temporarily unavailable. Please try again in a moment.";
  }

  if (includesAny(normalized, ["message is required", "report type is invalid", "limit must be"])) {
    return "*Request Error*\nI couldn't understand that request. Try a simpler TokenWatcher question like `today's spend` or `recent requests`.";
  }

  return "*OpenClaw Error*\nI hit an unexpected issue while talking to TokenWatcher.";
}

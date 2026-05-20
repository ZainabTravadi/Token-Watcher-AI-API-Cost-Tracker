/**
 * Internal retry policy module - handles error classification and backoff strategy
 */

export type ErrorCategory = "retryable" | "permanent" | "timeout" | "unknown";

export interface RetryPolicy {
  shouldRetry: (error: Error, attempt: number, maxAttempts: number) => boolean;
  getBackoffMs: (attempt: number) => number;
}

export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Classify an error to determine if it should be retried
 */
export function classifyError(error: Error | unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : String(error);

  // Timeout/AbortController abort
  if (message.includes("AbortError") || message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  // Network failures
  if (
    message.includes("fetch failed") ||
    message.includes("Failed to fetch") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("EHOSTUNREACH") ||
    message.includes("ENETUNREACH") ||
    message.includes("ENOTFOUND") ||
    message.includes("DNS")
  ) {
    return "retryable";
  }

  // HTTP response errors - check status code if available
  const statusMatch = message.match(/with (\d{3}):/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);

    // 5xx server errors - retryable
    if (status >= 500 && status < 600) {
      return "retryable";
    }

    // 4xx client errors - permanent (do not retry)
    if (status >= 400 && status < 500) {
      return "permanent";
    }

    // 3xx redirects, 2xx success (shouldn't happen here but...)
    if (status < 400) {
      return "permanent";
    }
  }

  // Default to retryable for unknown network errors
  return "unknown";
}

/**
 * Create standard retry policy
 */
export function createRetryPolicy(): RetryPolicy {
  return {
    shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean {
      if (attempt >= maxAttempts) {
        return false;
      }

      const category = classifyError(error);

      // Always retry timeouts and network failures
      if (category === "timeout" || category === "retryable") {
        return true;
      }

      // Never retry permanent errors
      if (category === "permanent") {
        return false;
      }

      // Unknown errors: retry up to maxAttempts
      return attempt < maxAttempts;
    },

    getBackoffMs(attempt: number): number {
      // Exponential backoff: 50ms, 200ms, 450ms, ...
      const baseMs = 50 * attempt * attempt;

      // Add jitter: ±20% to prevent thundering herd
      const jitterRange = baseMs * 0.4; // ±20%
      const jitter = (Math.random() - 0.5) * jitterRange;

      return Math.round(Math.max(10, baseMs + jitter)); // Minimum 10ms
    }
  };
}

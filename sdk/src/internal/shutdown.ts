/**
 * Internal shutdown module - handles graceful shutdown and cleanup
 */

declare const process: { on: (event: string, handler: () => void) => void; exit: (code: number) => void } | undefined;

export interface ShutdownManager {
  onShutdown(callback: () => Promise<void>): void;
  flushAndExit(timeoutMs?: number): Promise<void>;
}

interface ShutdownCallback {
  callback: () => Promise<void>;
  timeout: number;
}

const shutdownCallbacks: ShutdownCallback[] = [];
let shutdownInitialized = false;

/**
 * Initialize shutdown handlers
 */
function initializeShutdownHandlers(): void {
  if (shutdownInitialized) {
    return;
  }
  shutdownInitialized = true;

  // Node.js: handle graceful shutdown
  if (typeof globalThis !== "undefined") {
    const proc = (globalThis as any).process;
    if (proc && typeof proc.on === "function") {
      // SIGINT: Ctrl+C - graceful shutdown
      proc.on("SIGINT", () => {
        void flushAndWaitForCallbacks(5000).then(() => {
          if (typeof proc.exit === "function") {
            proc.exit(0);
          }
        });
      });

      // SIGTERM: termination signal - graceful shutdown
      proc.on("SIGTERM", () => {
        void flushAndWaitForCallbacks(5000).then(() => {
          if (typeof proc.exit === "function") {
            proc.exit(0);
          }
        });
      });
    }
  }
}

/**
 * Register a callback to be called on shutdown
 */
export function onShutdown(callback: () => Promise<void>, timeoutMs: number = 5000): void {
  initializeShutdownHandlers();
  shutdownCallbacks.push({ callback, timeout: timeoutMs });
}

/**
 * Flush queue with timeout and exit
 */
async function flushAndWaitForCallbacks(totalTimeoutMs: number): Promise<void> {
  const startTime = Date.now();
  const timePerCallback = Math.max(100, Math.floor(totalTimeoutMs / Math.max(1, shutdownCallbacks.length)));

  for (const { callback } of shutdownCallbacks) {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(100, totalTimeoutMs - elapsed);

    try {
      await Promise.race([
        callback(),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("Shutdown callback timeout")), remaining);
        })
      ]);
    } catch (error) {
      // Log but don't crash on shutdown callback errors
      if (error instanceof Error && error.message === "Shutdown callback timeout") {
        // Timeout - move to next callback
        continue;
      }
      // Other errors - log but continue
    }
  }
}

/**
 * Create a shutdown manager
 */
export function createShutdownManager(): ShutdownManager {
  return {
    onShutdown(callback: () => Promise<void>): void {
      onShutdown(callback, 5000);
    },

    async flushAndExit(timeoutMs: number = 5000): Promise<void> {
      await flushAndWaitForCallbacks(timeoutMs);
      // Only exit if in Node.js
      if (typeof globalThis !== "undefined") {
        const proc = (globalThis as any).process;
        if (proc && typeof proc.exit === "function") {
          proc.exit(0);
        }
      }
    }
  };
}

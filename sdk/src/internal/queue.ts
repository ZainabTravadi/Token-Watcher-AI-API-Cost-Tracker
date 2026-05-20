/**
 * Internal queue management module - handles bounded queue with overflow protection
 */

export interface QueueItem<T> {
  resolve: () => void;
  reject: (error: Error) => void;
  data: T;
}

export interface BoundedQueue<T> {
  push(item: QueueItem<T>): { ok: true } | { ok: false; error: Error };
  drain(): QueueItem<T>[];
  drainBatch(size: number): QueueItem<T>[];
  size(): number;
  isEmpty(): boolean;
}

export interface QueueConfig {
  maxSize: number;
  warningThreshold: number;
  debugMode?: boolean;
}

/**
 * Create a bounded queue with overflow protection
 */
export function createBoundedQueue<T>(config: QueueConfig): BoundedQueue<T> {
  const items: QueueItem<T>[] = [];
  let warningIssued = false;

  return {
    push(item: QueueItem<T>): { ok: true } | { ok: false; error: Error } {
      // Check if at capacity
      if (items.length >= config.maxSize) {
        const error = new Error(
          `TokenWatch queue capacity exceeded (max ${config.maxSize} items). ` +
            `Telemetry event rejected. Consider increasing batching interval or reducing event volume.`
        );
        return { ok: false, error };
      }

      // Issue warning at threshold
      if (items.length >= config.warningThreshold && !warningIssued) {
        console.warn(
          `TokenWatch queue approaching capacity (${items.length}/${config.maxSize} items). ` +
            `Network may be slow or backend may be overloaded.`
        );
        warningIssued = true;
      }

      // Reset warning flag when queue drains
      if (items.length < config.warningThreshold) {
        warningIssued = false;
      }

      items.push(item);

      if (config.debugMode) {
        console.debug(`[TokenWatch queue] +1 item, now ${items.length}/${config.maxSize}`);
      }

      return { ok: true };
    },

    drain(): QueueItem<T>[] {
      const drained = [...items];
      items.length = 0;
      warningIssued = false;

      if (config.debugMode && drained.length > 0) {
        console.debug(`[TokenWatch queue] drained ${drained.length} items`);
      }

      return drained;
    },

    drainBatch(size: number): QueueItem<T>[] {
      const take = Math.max(0, Math.min(size, items.length));
      const drained = items.splice(0, take);
      if (items.length < config.warningThreshold) {
        warningIssued = false;
      }

      if (config.debugMode && drained.length > 0) {
        console.debug(`[TokenWatch queue] drained ${drained.length} items`);
      }

      return drained;
    },

    size(): number {
      return items.length;
    },

    isEmpty(): boolean {
      return items.length === 0;
    }
  };
}

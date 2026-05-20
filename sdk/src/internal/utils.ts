/**
 * Small shared utilities for the SDK internals
 */

export function maybeUnref(timer: ReturnType<typeof setTimeout>): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref?: () => void }).unref?.();
  }
}

export function noop(): void {}

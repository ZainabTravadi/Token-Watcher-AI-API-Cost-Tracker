import type { TokenWatchStateSnapshot, TokenWatchTransportStats } from "./types.js";
import { classifyError, createRetryPolicy } from "./internal/retryPolicy.js";
import { createBoundedQueue } from "./internal/queue.js";
import { onShutdown } from "./internal/shutdown.js";
import { maybeUnref } from "./internal/utils.js";
import { createSignedHeaders } from "./security.js";

type RequestPayload = Record<string, unknown>;

interface PendingRequest {
  state: TokenWatchStateSnapshot;
  endpoint: string;
  payload: RequestPayload;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface TransportConfig {
  flushInterval: number;
  maxQueueSize: number;
  queueWarningThreshold: number;
  batchSize: number;
  retryAttempts: number;
  requestTimeoutMs: number;
  debug: boolean;
}

const config: TransportConfig = {
  flushInterval: 25,
  maxQueueSize: 1000,
  queueWarningThreshold: 500,
  batchSize: 50,
  retryAttempts: 3,
  requestTimeoutMs: 30_000,
  debug: typeof globalThis !== "undefined" && (globalThis as any).__TOKENWATCH_DEBUG === true
};

const queueConfig = {
  maxSize: config.maxQueueSize,
  warningThreshold: config.queueWarningThreshold,
  debugMode: config.debug
};

const queue = createBoundedQueue<PendingRequest>(queueConfig);

const retryPolicy = createRetryPolicy();
const inFlightControllers = new Set<AbortController>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentFlush: Promise<void> | null = null;
let shutdownRegistered = false;
let shuttingDown = false;

const metrics = {
  flushes: 0,
  retries: 0,
  rejected: 0,
  lastError: null as string | null
};

export function configureTransport(options: {
  maxQueueSize?: number;
  batchSize?: number;
  flushInterval?: number;
  retryAttempts?: number;
  debug?: boolean;
}): void {
  config.maxQueueSize = normalizePositiveInteger(options.maxQueueSize, config.maxQueueSize, 1);
  config.batchSize = normalizePositiveInteger(options.batchSize, config.batchSize, 1);
  config.flushInterval = normalizePositiveInteger(options.flushInterval, config.flushInterval, 0);
  config.retryAttempts = normalizePositiveInteger(options.retryAttempts, config.retryAttempts, 1);
  config.queueWarningThreshold = Math.max(1, Math.floor(config.maxQueueSize * 0.5));
  config.debug = options.debug ?? config.debug;
  queueConfig.maxSize = config.maxQueueSize;
  queueConfig.warningThreshold = config.queueWarningThreshold;
  queueConfig.debugMode = config.debug;
}

export async function postJson(state: TokenWatchStateSnapshot, endpoint: string, payload: RequestPayload): Promise<void> {
  registerShutdownOnce();

  if (shuttingDown) {
    throw new Error("TokenWatch transport is shutting down; telemetry event rejected.");
  }

  return new Promise<void>((resolve, reject) => {
    const result = queue.push({
      data: { state, endpoint, payload, resolve, reject },
      resolve: () => {},
      reject: () => {}
    });

    if (!result.ok) {
      metrics.rejected++;
      metrics.lastError = result.error.message;
      reject(result.error);
      return;
    }

    if (queue.size() >= config.batchSize) {
      void requestFlush();
      return;
    }

    scheduleFlush();
  });
}

export async function flush(): Promise<void> {
  clearFlushTimer();
  await requestFlush();
}

export async function flushAndShutdown(timeoutMs: number = 5000): Promise<void> {
  shuttingDown = true;
  await flushWithTimeout(Math.max(100, timeoutMs));
}

export function getQueueSize(): number {
  return queue.size();
}

export function getTransportStats(): TokenWatchTransportStats {
  return {
    queueSize: queue.size(),
    maxQueueSize: config.maxQueueSize,
    inFlight: inFlightControllers.size,
    isFlushing: currentFlush !== null,
    scheduled: flushTimer !== null,
    flushes: metrics.flushes,
    retries: metrics.retries,
    rejected: metrics.rejected,
    lastError: metrics.lastError
  };
}

export function __resetTransportForTests(): void {
  clearFlushTimer();
  const drained = queue.drain();
  for (const item of drained) {
    item.data.reject(new Error("TokenWatch transport test reset"));
  }
  for (const controller of Array.from(inFlightControllers)) {
    controller.abort();
  }
  inFlightControllers.clear();
  currentFlush = null;
  shuttingDown = false;
  metrics.flushes = 0;
  metrics.retries = 0;
  metrics.rejected = 0;
  metrics.lastError = null;
  configureTransport({
    maxQueueSize: 1000,
    batchSize: 50,
    flushInterval: 25,
    retryAttempts: 3,
    debug: typeof globalThis !== "undefined" && (globalThis as any).__TOKENWATCH_DEBUG === true
  });
}

function registerShutdownOnce(): void {
  if (shutdownRegistered) {
    return;
  }
  shutdownRegistered = true;
  onShutdown(() => flushAndShutdown(5000));
}

function scheduleFlush(): void {
  if (flushTimer || currentFlush || queue.isEmpty()) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void requestFlush();
  }, config.flushInterval);
  maybeUnref(flushTimer);
}

function clearFlushTimer(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

async function requestFlush(signal?: AbortSignal): Promise<void> {
  if (currentFlush) {
    await currentFlush;
    if (queue.isEmpty()) {
      return;
    }
  }

  if (queue.isEmpty()) {
    return;
  }

  currentFlush = runFlush(signal).finally(() => {
    currentFlush = null;
    if (!queue.isEmpty() && !shuttingDown) {
      scheduleFlush();
    }
  });

  await currentFlush;
}

async function runFlush(signal?: AbortSignal): Promise<void> {
  metrics.flushes++;

  while (!queue.isEmpty()) {
    if (signal?.aborted) {
      rejectRemaining(new Error("TokenWatch shutdown flush aborted"));
      return;
    }

    const drained = queue.drainBatch(config.batchSize);
    const requests = drained.map((item) => item.data);

    if (config.debug) {
      console.debug(`[TokenWatch transport] flushing ${requests.length} request(s)`);
    }

    for (const group of groupRequests(requests)) {
      await deliverGroup(group, signal);
    }

    if (!shuttingDown) {
      break;
    }
  }
}

async function flushWithTimeout(timeoutMs: number): Promise<void> {
  clearFlushTimer();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    for (const inFlight of Array.from(inFlightControllers)) {
      inFlight.abort();
    }
  }, timeoutMs);
  maybeUnref(timeoutId);

  try {
    await Promise.race([
      requestFlush(controller.signal),
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        maybeUnref(timer);
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function rejectRemaining(error: Error): void {
  const drained = queue.drain();
  for (const item of drained) {
    item.data.reject(error);
  }
}

function groupRequests(
  requests: PendingRequest[]
): Array<{ state: TokenWatchStateSnapshot; endpoint: string; payloads: RequestPayload[]; callbacks: Array<{ resolve: () => void; reject: (error: Error) => void }> }> {
  const groups = new Map<
    string,
    { state: TokenWatchStateSnapshot; endpoint: string; payloads: RequestPayload[]; callbacks: Array<{ resolve: () => void; reject: (error: Error) => void }> }
  >();

  for (const request of requests) {
    const key = `${request.state.apiUrl}|${request.endpoint}|${request.state.workspaceId}|${JSON.stringify(request.state.headers)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.payloads.push(request.payload);
      existing.callbacks.push({ resolve: request.resolve, reject: request.reject });
      continue;
    }

    groups.set(key, {
      state: request.state,
      endpoint: request.endpoint,
      payloads: [request.payload],
      callbacks: [{ resolve: request.resolve, reject: request.reject }]
    });
  }

  return [...groups.values()];
}

async function deliverGroup(
  group: { state: TokenWatchStateSnapshot; endpoint: string; payloads: RequestPayload[]; callbacks: Array<{ resolve: () => void; reject: (error: Error) => void }> },
  signal?: AbortSignal
): Promise<void> {
  const body = group.payloads.length === 1 ? group.payloads[0] : { data: group.payloads };

  try {
    await retryRequest(group.state, group.endpoint, body, signal);

    for (const callback of group.callbacks) {
      callback.resolve();
    }
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    metrics.lastError = normalizedError.message;

    for (const callback of group.callbacks) {
      callback.reject(normalizedError);
    }
  }
}

async function retryRequest(state: TokenWatchStateSnapshot, endpoint: string, payload: RequestPayload, signal?: AbortSignal): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error("TokenWatch request aborted during shutdown");
    }

    try {
      await sendRequest(state, endpoint, payload, signal);

      if (config.debug && attempt > 1) {
        console.debug(`[TokenWatch transport] request succeeded after ${attempt} attempts`);
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (signal?.aborted || !retryPolicy.shouldRetry(lastError, attempt, config.retryAttempts)) {
        if (config.debug) {
          console.debug(`[TokenWatch transport] not retrying (error category: ${classifyError(lastError)})`);
        }
        throw lastError;
      }

      const backoffMs = retryPolicy.getBackoffMs(attempt);
      metrics.retries++;

      if (config.debug) {
        console.debug(`[TokenWatch transport] retry ${attempt}/${config.retryAttempts - 1} after ${backoffMs}ms`);
      }

      await delay(backoffMs, signal);
    }
  }

  throw lastError ?? new Error("TokenWatch request failed");
}

async function sendRequest(state: TokenWatchStateSnapshot, endpoint: string, payload: RequestPayload, shutdownSignal?: AbortSignal): Promise<void> {
  const targetUrl = resolveUrl(state.apiUrl, endpoint);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  maybeUnref(timeoutId);

  const abortFromShutdown = (): void => controller.abort();
  shutdownSignal?.addEventListener("abort", abortFromShutdown, { once: true });
  inFlightControllers.add(controller);

  try {
    const body = JSON.stringify(payload);
    const signedHeaders = await createSignedHeaders(state, "POST", extractPath(targetUrl), body);
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...signedHeaders,
        ...state.headers
      },
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      const bodyText = await safeReadBody(response);
      throw new Error(`TokenWatch request failed with ${response.status}: ${bodyText}`);
    }
  } finally {
    clearTimeout(timeoutId);
    shutdownSignal?.removeEventListener("abort", abortFromShutdown);
    inFlightControllers.delete(controller);
  }
}

function extractPath(url: string): string {
  return new URL(url).pathname;
}

function resolveUrl(apiUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return (await response.text()) || response.statusText;
  } catch {
    return response.statusText;
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("TokenWatch retry delay aborted during shutdown"));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    maybeUnref(timer);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("TokenWatch retry delay aborted during shutdown"));
      },
      { once: true }
    );
  });
}

function normalizePositiveInteger(value: number | undefined, fallback: number, min: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.round(value));
}

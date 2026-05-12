import type { TokenWatchStateSnapshot } from "./types.js";

type RequestPayload = Record<string, unknown>;

interface PendingRequest {
  state: TokenWatchStateSnapshot;
  endpoint: string;
  payload: RequestPayload;
  resolve: () => void;
  reject: (error: Error) => void;
}

const pendingRequests: PendingRequest[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
const batchWindowMs = 25;
const maxAttempts = 3;

export async function postJson(state: TokenWatchStateSnapshot, endpoint: string, payload: RequestPayload): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    pendingRequests.push({ state, endpoint, payload, resolve, reject });

    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        void flushQueue();
      }, batchWindowMs);
      maybeUnref(flushTimer);
    }
  });
}

async function flushQueue(): Promise<void> {
  if (flushing) {
    return;
  }

  flushing = true;
  flushTimer = null;

  try {
    const requests = pendingRequests.splice(0, pendingRequests.length);
    const groups = groupRequests(requests);

    for (const group of groups) {
      await deliverGroup(group);
    }
  } finally {
    flushing = false;
  }
}

function groupRequests(requests: PendingRequest[]): Array<{ state: TokenWatchStateSnapshot; endpoint: string; payloads: RequestPayload[]; resolveList: Array<() => void>; rejectList: Array<(error: Error) => void> }> {
  const groups = new Map<string, { state: TokenWatchStateSnapshot; endpoint: string; payloads: RequestPayload[]; resolveList: Array<() => void>; rejectList: Array<(error: Error) => void> }>();

  for (const request of requests) {
    const key = `${request.state.apiUrl}|${request.endpoint}|${request.state.projectId}|${JSON.stringify(request.state.headers)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.payloads.push(request.payload);
      existing.resolveList.push(request.resolve);
      existing.rejectList.push(request.reject);
      continue;
    }

    groups.set(key, {
      state: request.state,
      endpoint: request.endpoint,
      payloads: [request.payload],
      resolveList: [request.resolve],
      rejectList: [request.reject]
    });
  }

  return [...groups.values()];
}

async function deliverGroup(group: { state: TokenWatchStateSnapshot; endpoint: string; payloads: RequestPayload[]; resolveList: Array<() => void>; rejectList: Array<(error: Error) => void> }): Promise<void> {
  const body = group.payloads.length === 1 ? group.payloads[0] : { data: group.payloads };

  try {
    await retryRequest(group.state, group.endpoint, body);
    for (const resolve of group.resolveList) {
      resolve();
    }
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    for (const reject of group.rejectList) {
      reject(normalizedError);
    }
  }
}

async function retryRequest(state: TokenWatchStateSnapshot, endpoint: string, payload: RequestPayload): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const targetUrl = resolveUrl(state.apiUrl, endpoint);
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TokenWatch-Project": state.projectId,
          ...state.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const bodyText = await safeReadBody(response);
        throw new Error(`TokenWatch request failed with ${response.status}: ${bodyText}`);
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await delay(50 * attempt * attempt);
      }
    }
  }

  throw lastError ?? new Error("TokenWatch request failed");
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function maybeUnref(timer: ReturnType<typeof setTimeout>): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref?: () => void }).unref?.();
  }
}
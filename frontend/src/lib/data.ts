const safeNumber = (n: number): number => (Number.isFinite(n) ? n : 0);

export const fmtUSD = (n: number) => {
  const value = safeNumber(n);
  return value < 0.01
    ? `$${value.toFixed(6)}`
    : value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtNum = (n: number) => safeNumber(n).toLocaleString("en-US");

export const fmtPercent = (n: number, fractionDigits = 2) => `${(safeNumber(n) * 100).toFixed(fractionDigits)}%`;

export const fmtMs = (n: number) => `${Math.round(safeNumber(n))} ms`;

export const fmtLatency = (n: number): string => {
  const value = safeNumber(n);
  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }

  const seconds = value / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
};

export const fmtRelativeTime = (timestamp: number | string): string => {
  const ts = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  const now = Date.now();
  const diff = now - ts;

  if (!Number.isFinite(ts) || diff <= 0) return "just now";

  if (diff < 1000) return "just now";
  if (diff < 60 * 1000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 60 * 60 * 1000) return `${Math.round(diff / (60 * 1000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / (60 * 60 * 1000))}h ago`;
  return `${Math.round(diff / (24 * 60 * 60 * 1000))}d ago`;
};

export const fmtCompactNum = (n: number): string => {
  const value = safeNumber(n);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

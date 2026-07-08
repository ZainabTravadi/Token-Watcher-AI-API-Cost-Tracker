import { buildAnalyticsSnapshot } from "./analyticsService";
import {
  listTelemetryHistoryBuckets,
  listTelemetryResourcePeriodSummaries,
  type TelemetryHistoryBucket,
  type TelemetryResourcePeriodSummary
} from "./telemetryRepository";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface IntelligenceAnomaly {
  id: string;
  severity: AnomalySeverity;
  confidence: number;
  title: string;
  description: string;
  affectedResource: {
    type: "workspace" | "model" | "provider" | "endpoint" | "budget";
    id: string;
  };
  supportingData: Record<string, number | string>;
  recommendedAction: string;
  timestamp: number;
}

export async function detectAnomalies(workspaceId: string): Promise<IntelligenceAnomaly[]> {
  const [snapshot, buckets, models, providers, endpoints] = await Promise.all([
    buildAnalyticsSnapshot(workspaceId),
    listTelemetryHistoryBuckets(workspaceId, 336, 1),
    listTelemetryResourcePeriodSummaries(workspaceId, "model", 24, 336),
    listTelemetryResourcePeriodSummaries(workspaceId, "provider", 24, 336),
    listTelemetryResourcePeriodSummaries(workspaceId, "route", 24, 336)
  ]);

  const anomalies: IntelligenceAnomaly[] = [];
  const latest = buckets.at(-1);
  const baseline = latest ? buckets.slice(0, -1) : buckets;

  if (latest && baseline.length >= 3) {
    pushMetricAnomaly(anomalies, "cost-spike", "Cost spike", "Hourly cost is above the historical baseline.", "workspace", workspaceId, latest.cost_usd, baseline.map((row) => row.cost_usd), "Review recent high-cost models and endpoints.", latest.bucket_start);
    pushMetricAnomaly(anomalies, "latency-spike", "Latency spike", "Average latency is above the historical baseline.", "workspace", workspaceId, latest.avg_latency_ms, baseline.map((row) => row.avg_latency_ms), "Inspect slow endpoints and enable streaming where appropriate.", latest.bucket_start);
    pushMetricAnomaly(anomalies, "error-spike", "Error spike", "Error count is above the historical baseline.", "workspace", workspaceId, latest.errors, baseline.map((row) => row.errors), "Inspect recent failed requests and retry settings.", latest.bucket_start);
    pushMetricAnomaly(anomalies, "token-spike", "Token spike", "Average token usage is above the historical baseline.", "workspace", workspaceId, latest.avg_total_tokens, baseline.map((row) => row.avg_total_tokens), "Reduce prompt context and retrieval payload sizes.", latest.bucket_start);
  }

  const budget = snapshot.overview.budget;
  if (budget > 0 && snapshot.overview.spendToday > 0) {
    const projectedMonthlySpend = snapshot.overview.spendToday * daysInCurrentMonth();
    const budgetBaseline = snapshot.timeline.map((row) => row.cost_usd * daysInCurrentMonth());
    const stats = summarize(budgetBaseline);
    const budgetRisk = projectedMonthlySpend > Math.max(budget, stats.mean + stats.stddev);
    if (budgetRisk) {
      anomalies.push({
        id: "budget-risk",
        severity: severityFromRatio(projectedMonthlySpend, Math.max(budget, stats.mean || budget)),
        confidence: confidenceFromDeviation(projectedMonthlySpend, stats),
        title: "Budget risk",
        description: "Projected monthly spend is above the configured budget or recent spend baseline.",
        affectedResource: { type: "budget", id: workspaceId },
        supportingData: { budget, spendToday: snapshot.overview.spendToday, projectedMonthlySpend },
        recommendedAction: "Apply cost recommendations and review high-cost routes before month end.",
        timestamp: Date.now()
      });
    }
  }

  detectResourceDegradation(anomalies, "provider-degradation", "Provider degradation", "provider", providers, "Review provider-specific latency, errors, and fallback behavior.");
  detectResourceDegradation(anomalies, "model-degradation", "Model degradation", "model", models, "Review model tier, token volume, and retry behavior.");
  detectResourceDegradation(anomalies, "endpoint-degradation", "Endpoint degradation", "endpoint", endpoints, "Inspect endpoint prompts, upstream dependencies, and timeouts.");

  return anomalies.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function pushMetricAnomaly(
  anomalies: IntelligenceAnomaly[],
  id: string,
  title: string,
  description: string,
  type: IntelligenceAnomaly["affectedResource"]["type"],
  resourceId: string,
  current: number,
  baselineValues: number[],
  recommendedAction: string,
  timestamp: number
): void {
  const stats = summarize(baselineValues);
  if (!isAnomalous(current, stats)) return;
  anomalies.push({
    id,
    severity: severityFromRatio(current, stats.mean + stats.stddev),
    confidence: confidenceFromDeviation(current, stats),
    title,
    description,
    affectedResource: { type, id: resourceId },
    supportingData: { current, baselineMean: stats.mean, baselineStddev: stats.stddev },
    recommendedAction,
    timestamp
  });
}

function detectResourceDegradation(
  anomalies: IntelligenceAnomaly[],
  idPrefix: string,
  title: string,
  type: "model" | "provider" | "endpoint",
  rows: TelemetryResourcePeriodSummary[],
  recommendedAction: string
): void {
  const latencyRatios = rows.map((row) => ratio(row.current_avg_latency_ms, row.baseline_avg_latency_ms)).filter(Number.isFinite);
  const errorRatios = rows.map((row) => ratio(rate(row.current_errors, row.current_requests), rate(row.baseline_errors, row.baseline_requests))).filter(Number.isFinite);
  const latencyStats = summarize(latencyRatios);
  const errorStats = summarize(errorRatios);

  for (const row of rows) {
    if (row.current_requests <= 0 || row.baseline_requests <= 0) continue;
    const latencyRatio = ratio(row.current_avg_latency_ms, row.baseline_avg_latency_ms);
    const errorRatio = ratio(rate(row.current_errors, row.current_requests), rate(row.baseline_errors, row.baseline_requests));
    const degraded = isAnomalous(latencyRatio, latencyStats) || isAnomalous(errorRatio, errorStats);
    if (!degraded) continue;
    anomalies.push({
      id: `${idPrefix}:${row.resource}`,
      severity: severityFromRatio(Math.max(latencyRatio, errorRatio), Math.max(latencyStats.mean + latencyStats.stddev, errorStats.mean + errorStats.stddev)),
      confidence: Math.max(confidenceFromDeviation(latencyRatio, latencyStats), confidenceFromDeviation(errorRatio, errorStats)),
      title,
      description: `${row.resource} is performing worse than its historical baseline.`,
      affectedResource: { type, id: row.resource },
      supportingData: {
        currentRequests: row.current_requests,
        baselineRequests: row.baseline_requests,
        latencyRatio,
        errorRatio
      },
      recommendedAction,
      timestamp: Date.now()
    });
  }
}

function summarize(values: number[]): { mean: number; stddev: number } {
  const finite = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (finite.length === 0) return { mean: 0, stddev: 0 };
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length;
  return { mean, stddev: Math.sqrt(variance) };
}

function isAnomalous(current: number, stats: { mean: number; stddev: number }): boolean {
  if (!Number.isFinite(current) || stats.mean <= 0) return false;
  return current > stats.mean + stats.stddev;
}

function confidenceFromDeviation(current: number, stats: { mean: number; stddev: number }): number {
  if (stats.mean <= 0) return 0.4;
  const denominator = stats.stddev > 0 ? stats.stddev : stats.mean;
  return clamp(0.45 + ((current - stats.mean) / denominator) * 0.12, 0.45, 0.95);
}

function severityFromRatio(current: number, baseline: number): AnomalySeverity {
  const value = ratio(current, baseline);
  if (value >= 3) return "critical";
  if (value >= 2) return "high";
  if (value >= 1.35) return "medium";
  return "low";
}

function severityRank(severity: AnomalySeverity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity];
}

function ratio(current: number, baseline: number): number {
  if (baseline <= 0) return current > 0 ? current : 0;
  return current / baseline;
}

function rate(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

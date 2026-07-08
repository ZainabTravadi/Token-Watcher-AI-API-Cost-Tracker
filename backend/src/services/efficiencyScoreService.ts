import { buildAnalyticsSnapshot } from "./analyticsService";

export interface EfficiencyScoreResponse {
  overallScore: number;
  categoryScores: {
    costEfficiency: number;
    latency: number;
    errorRate: number;
    tokenEfficiency: number;
    providerDiversity: number;
    modelUtilization: number;
    requestSuccessRate: number;
  };
  strengths: string[];
  weaknesses: string[];
  improvementSuggestions: string[];
}

export async function calculateEfficiencyScore(workspaceId: string): Promise<EfficiencyScoreResponse> {
  const snapshot = await buildAnalyticsSnapshot(workspaceId);
  const totalRequests = snapshot.models.reduce((sum, row) => sum + row.requests, 0);
  const totalCost = snapshot.models.reduce((sum, row) => sum + row.cost_usd, 0);
  const totalTokens = snapshot.models.reduce((sum, row) => sum + row.tokens, 0);
  const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;
  const avgTokensPerRequest = totalRequests > 0 ? totalTokens / totalRequests : 0;
  const weightedLatency = weightedAverage(snapshot.models.map((row) => ({ value: row.avg_latency_ms, weight: row.requests })));
  const modelCosts = snapshot.models.map((row) => row.requests > 0 ? row.cost_usd / row.requests : 0);
  const endpointLatencies = snapshot.endpoints.map((row) => row.avg_latency_ms);
  const modelTokens = snapshot.models.map((row) => row.requests > 0 ? row.tokens / row.requests : 0);

  const categoryScores = {
    costEfficiency: inversePeerScore(avgCostPerRequest, modelCosts),
    latency: inversePeerScore(weightedLatency, endpointLatencies),
    errorRate: scoreRate(1 - snapshot.overview.errorRate),
    tokenEfficiency: inversePeerScore(avgTokensPerRequest, modelTokens),
    providerDiversity: entropyScore(groupBy(snapshot.models, (row) => row.provider, (row) => row.requests)),
    modelUtilization: entropyScore(groupBy(snapshot.models, (row) => row.model, (row) => row.requests)),
    requestSuccessRate: scoreRate(1 - snapshot.overview.errorRate)
  };

  const overallScore = Math.round(weightedAverage([
    { value: categoryScores.costEfficiency, weight: 1.2 },
    { value: categoryScores.latency, weight: 1 },
    { value: categoryScores.errorRate, weight: 1.1 },
    { value: categoryScores.tokenEfficiency, weight: 1 },
    { value: categoryScores.providerDiversity, weight: 0.6 },
    { value: categoryScores.modelUtilization, weight: 0.7 },
    { value: categoryScores.requestSuccessRate, weight: 1.2 }
  ]));

  const strengths = Object.entries(categoryScores)
    .filter(([, score]) => score >= 75)
    .map(([key]) => strengthText(key));

  const weaknesses = Object.entries(categoryScores)
    .filter(([, score]) => score < 55)
    .map(([key]) => weaknessText(key));

  const improvementSuggestions = buildSuggestions(categoryScores);

  return {
    overallScore,
    categoryScores: mapScores(categoryScores),
    strengths,
    weaknesses,
    improvementSuggestions
  };
}

function inversePeerScore(value: number, peers: number[]): number {
  const finite = peers.filter((item) => Number.isFinite(item) && item >= 0);
  if (finite.length === 0 || value <= 0) return 100;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return 85;
  return clamp(100 - ((value - min) / (max - min)) * 100, 0, 100);
}

function entropyScore(groups: Record<string, number>): number {
  const values = Object.values(groups).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.length <= 1 || total <= 0) return values.length === 1 ? 55 : 100;
  const entropy = values.reduce((sum, value) => {
    const p = value / total;
    return sum - p * Math.log2(p);
  }, 0);
  return clamp((entropy / Math.log2(values.length)) * 100, 0, 100);
}

function groupBy<T>(rows: T[], key: (row: T) => string, value: (row: T) => number): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const group = key(row);
    acc[group] = (acc[group] ?? 0) + value(row);
    return acc;
  }, {});
}

function scoreRate(value: number): number {
  return clamp(value * 100, 0, 100);
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight > 0 ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight : 0;
}

function mapScores<T extends Record<string, number>>(scores: T): T {
  return Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Math.round(value)])) as T;
}

function buildSuggestions(scores: EfficiencyScoreResponse["categoryScores"]): string[] {
  const suggestions: string[] = [];
  if (scores.costEfficiency < 70) suggestions.push("Review high-cost model routes and move simple workloads to cheaper Gemini tiers.");
  if (scores.latency < 70) suggestions.push("Enable streaming and inspect slow endpoints with above-average latency.");
  if (scores.errorRate < 70 || scores.requestSuccessRate < 70) suggestions.push("Audit retry, timeout, and provider fallback behavior on failing requests.");
  if (scores.tokenEfficiency < 70) suggestions.push("Reduce prompt and context tokens on high-volume endpoints.");
  if (scores.providerDiversity < 70) suggestions.push("Reduce concentration risk by validating fallback coverage within Gemini model tiers.");
  if (scores.modelUtilization < 70) suggestions.push("Consolidate underused models and document model routing rules.");
  return suggestions.slice(0, 6);
}

function strengthText(key: string): string {
  return ({
    costEfficiency: "Cost per request is efficient relative to active models.",
    latency: "Latency is healthy relative to observed endpoints.",
    errorRate: "Error rate is low.",
    tokenEfficiency: "Token usage per request is controlled.",
    providerDiversity: "Provider usage is well distributed.",
    modelUtilization: "Model usage is balanced.",
    requestSuccessRate: "Request success rate is strong."
  } as Record<string, string>)[key] ?? key;
}

function weaknessText(key: string): string {
  return ({
    costEfficiency: "Cost per request is high relative to active models.",
    latency: "Latency is elevated relative to observed endpoints.",
    errorRate: "Error rate is weakening efficiency.",
    tokenEfficiency: "Token usage per request is high.",
    providerDiversity: "Provider usage is concentrated.",
    modelUtilization: "Model utilization is concentrated.",
    requestSuccessRate: "Request failures are reducing efficiency."
  } as Record<string, string>)[key] ?? key;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

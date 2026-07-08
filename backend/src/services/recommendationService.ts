import { buildAnalyticsSnapshot } from "./analyticsService";
import { listTelemetryResourcePeriodSummaries } from "./telemetryRepository";

export type RecommendationCategory = "cost" | "performance" | "reliability" | "tokens" | "operations";
export type RecommendationPriority = "low" | "medium" | "high" | "critical";
export type RecommendationDifficulty = "low" | "medium" | "high";

export interface IntelligenceRecommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  confidence: number;
  estimatedSavings: number;
  difficulty: RecommendationDifficulty;
  affectedModels: string[];
  affectedEndpoints: string[];
  supportingMetrics: Record<string, number | string | string[]>;
}

export async function generateRecommendations(workspaceId: string): Promise<IntelligenceRecommendation[]> {
  const snapshot = await buildAnalyticsSnapshot(workspaceId);
  const modelPeriods = await listTelemetryResourcePeriodSummaries(workspaceId, "model", 24, 336);
  const endpointPeriods = await listTelemetryResourcePeriodSummaries(workspaceId, "route", 24, 336);
  const providerPeriods = await listTelemetryResourcePeriodSummaries(workspaceId, "provider", 24, 336);

  const totalCost = snapshot.models.reduce((sum, row) => sum + row.cost_usd, 0);
  const totalRequests = snapshot.models.reduce((sum, row) => sum + row.requests, 0);
  const avgModelCost = mean(snapshot.models.map((row) => row.requests > 0 ? row.cost_usd / row.requests : 0));
  const avgTokens = mean(snapshot.models.map((row) => row.requests > 0 ? row.tokens / row.requests : 0));
  const avgLatency = weightedAverage(snapshot.models.map((row) => ({ value: row.avg_latency_ms, weight: row.requests })));
  const errorRate = snapshot.overview.errorRate;
  const recommendations: IntelligenceRecommendation[] = [];

  const expensiveModels = snapshot.models.filter((row) => row.requests > 0 && row.cost_usd / row.requests > avgModelCost && row.cost_usd > totalCost / Math.max(snapshot.models.length, 1));
  if (expensiveModels.length > 0) {
    const affectedModels = expensiveModels.map((row) => row.model);
    recommendations.push({
      id: "switch-to-cheaper-model",
      title: "Switch eligible traffic to a cheaper model",
      description: "High-cost models are carrying a disproportionate share of spend. Route simple or low-risk workloads to a lower-cost Gemini model tier where quality requirements allow.",
      category: "cost",
      priority: priorityFromShare(sum(expensiveModels.map((row) => row.cost_usd)), totalCost),
      confidence: confidenceFromSamples(sum(expensiveModels.map((row) => row.requests)), totalRequests),
      estimatedSavings: sum(expensiveModels.map((row) => row.cost_usd)) * 0.18,
      difficulty: "medium",
      affectedModels,
      affectedEndpoints: topEndpoints(snapshot.endpoints, 3),
      supportingMetrics: {
        totalCost,
        affectedModelCost: sum(expensiveModels.map((row) => row.cost_usd)),
        averageModelCostPerRequest: avgModelCost
      }
    });
  }

  const tokenHeavyModels = snapshot.models.filter((row) => row.requests > 0 && row.tokens / row.requests > avgTokens);
  if (tokenHeavyModels.length > 0) {
    recommendations.push({
      id: "reduce-prompt-tokens",
      title: "Reduce prompt tokens",
      description: "Token-heavy models exceed the workspace average token footprint. Trim repeated instructions, retrieved context, and verbose system prompts.",
      category: "tokens",
      priority: priorityFromShare(sum(tokenHeavyModels.map((row) => row.tokens)), sum(snapshot.models.map((row) => row.tokens))),
      confidence: confidenceFromSamples(sum(tokenHeavyModels.map((row) => row.requests)), totalRequests),
      estimatedSavings: sum(tokenHeavyModels.map((row) => row.cost_usd)) * 0.12,
      difficulty: "low",
      affectedModels: tokenHeavyModels.map((row) => row.model),
      affectedEndpoints: topEndpoints(snapshot.endpoints, 5),
      supportingMetrics: {
        averageTokensPerRequest: avgTokens,
        affectedTokens: sum(tokenHeavyModels.map((row) => row.tokens))
      }
    });
  }

  const repeatedRoutes = endpointPeriods.filter((row) => row.current_requests > mean(endpointPeriods.map((item) => item.current_requests)));
  if (repeatedRoutes.length > 0) {
    recommendations.push({
      id: "enable-prompt-caching",
      title: "Enable prompt caching",
      description: "High-volume endpoints are good candidates for caching stable system prompts, shared retrieval payloads, or deterministic responses.",
      category: "cost",
      priority: "medium",
      confidence: confidenceFromSamples(sum(repeatedRoutes.map((row) => row.current_requests)), totalRequests),
      estimatedSavings: sum(repeatedRoutes.map((row) => row.current_cost_usd)) * 0.1,
      difficulty: "medium",
      affectedModels: topModels(snapshot.models, 5),
      affectedEndpoints: repeatedRoutes.slice(0, 5).map((row) => row.resource),
      supportingMetrics: {
        repeatedEndpointRequests: sum(repeatedRoutes.map((row) => row.current_requests)),
        repeatedEndpointCost: sum(repeatedRoutes.map((row) => row.current_cost_usd))
      }
    });
  }

  if (totalRequests > 0) {
    recommendations.push({
      id: "batch-requests",
      title: "Batch compatible requests",
      description: "Batch low-priority or background AI requests to smooth throughput and reduce per-request overhead.",
      category: "operations",
      priority: totalRequests > mean(endpointPeriods.map((row) => row.baseline_requests)) ? "medium" : "low",
      confidence: confidenceFromSamples(totalRequests, totalRequests),
      estimatedSavings: totalCost * 0.06,
      difficulty: "medium",
      affectedModels: topModels(snapshot.models, 4),
      affectedEndpoints: topEndpoints(snapshot.endpoints, 4),
      supportingMetrics: { totalRequests, totalCost }
    });
  }

  const slowEndpoints = snapshot.endpoints.filter((row) => row.avg_latency_ms > mean(snapshot.endpoints.map((item) => item.avg_latency_ms)));
  if (slowEndpoints.length > 0) {
    recommendations.push({
      id: "enable-streaming",
      title: "Enable streaming on slower endpoints",
      description: "Endpoints with above-average latency can improve perceived performance by streaming tokens to clients.",
      category: "performance",
      priority: "medium",
      confidence: confidenceFromSamples(sum(slowEndpoints.map((row) => row.requests)), totalRequests),
      estimatedSavings: 0,
      difficulty: "low",
      affectedModels: topModels(snapshot.models, 3),
      affectedEndpoints: slowEndpoints.slice(0, 5).map((row) => row.route),
      supportingMetrics: { averageLatencyMs: avgLatency, slowEndpointCount: slowEndpoints.length }
    });
  }

  const contextHeavyEndpoints = endpointPeriods.filter((row) => row.current_avg_total_tokens > mean(endpointPeriods.map((item) => item.current_avg_total_tokens)));
  if (contextHeavyEndpoints.length > 0) {
    recommendations.push({
      id: "reduce-context-size",
      title: "Reduce context size",
      description: "Several endpoints have above-average total token usage. Use tighter retrieval limits and shorter conversation windows.",
      category: "tokens",
      priority: "medium",
      confidence: confidenceFromSamples(sum(contextHeavyEndpoints.map((row) => row.current_requests)), totalRequests),
      estimatedSavings: sum(contextHeavyEndpoints.map((row) => row.current_cost_usd)) * 0.08,
      difficulty: "medium",
      affectedModels: topModels(snapshot.models, 4),
      affectedEndpoints: contextHeavyEndpoints.slice(0, 5).map((row) => row.resource),
      supportingMetrics: { averageEndpointTokens: mean(endpointPeriods.map((row) => row.current_avg_total_tokens)) }
    });
  }

  const dominantProvider = providerPeriods[0];
  if (dominantProvider && totalCost > 0 && dominantProvider.current_cost_usd / totalCost > providerCostShareMean(providerPeriods, totalCost)) {
    recommendations.push({
      id: "optimize-provider-usage",
      title: "Optimize provider usage",
      description: "Spend is concentrated in one provider. Keep Gemini as the provider but review model-tier allocation and fallback paths within Gemini.",
      category: "cost",
      priority: priorityFromShare(dominantProvider.current_cost_usd, totalCost),
      confidence: confidenceFromSamples(dominantProvider.current_requests, totalRequests),
      estimatedSavings: dominantProvider.current_cost_usd * 0.07,
      difficulty: "medium",
      affectedModels: topModels(snapshot.models.filter((row) => row.provider === dominantProvider.resource), 5),
      affectedEndpoints: topEndpoints(snapshot.endpoints, 5),
      supportingMetrics: { provider: dominantProvider.resource, providerCostShare: dominantProvider.current_cost_usd / totalCost }
    });
  }

  if (errorRate > mean([errorRate, ...modelPeriods.map((row) => safeRate(row.baseline_errors, row.baseline_requests))])) {
    recommendations.push({
      id: "reduce-retries",
      title: "Reduce retries",
      description: "Observed error patterns suggest retry behavior may be amplifying failed traffic. Review retry caps and backoff policies on error-prone endpoints.",
      category: "reliability",
      priority: errorRate > 0 ? "medium" : "low",
      confidence: clamp(errorRate * 5, 0.35, 0.9),
      estimatedSavings: totalCost * errorRate * 0.2,
      difficulty: "low",
      affectedModels: modelPeriods.filter((row) => row.current_errors > 0).slice(0, 5).map((row) => row.resource),
      affectedEndpoints: endpointPeriods.filter((row) => row.current_errors > 0).slice(0, 5).map((row) => row.resource),
      supportingMetrics: { errorRate, errorsToday: snapshot.overview.errors429 + snapshot.overview.errors500 }
    });
  }

  const hotModels = snapshot.models.filter((row) => row.requests > 0 && row.tokens / row.requests > avgTokens);
  if (hotModels.length > 0) {
    recommendations.push({
      id: "lower-temperature",
      title: "Lower temperature for deterministic paths",
      description: "High-token, high-volume paths may benefit from lower-temperature generation to reduce output variance and retries.",
      category: "tokens",
      priority: "low",
      confidence: confidenceFromSamples(sum(hotModels.map((row) => row.requests)), totalRequests) * 0.8,
      estimatedSavings: sum(hotModels.map((row) => row.cost_usd)) * 0.04,
      difficulty: "low",
      affectedModels: hotModels.slice(0, 5).map((row) => row.model),
      affectedEndpoints: topEndpoints(snapshot.endpoints, 5),
      supportingMetrics: { averageTokensPerRequest: avgTokens }
    });
  }

  const unusedExpensiveModels = modelPeriods.filter((row) => row.current_requests === 0 && row.baseline_cost_usd > mean(modelPeriods.map((item) => item.baseline_cost_usd)));
  if (unusedExpensiveModels.length > 0) {
    recommendations.push({
      id: "detect-unused-expensive-models",
      title: "Retire unused expensive models",
      description: "Historically expensive models have no current traffic. Remove stale routing, alerts, and configuration references if they are no longer needed.",
      category: "operations",
      priority: "low",
      confidence: 0.7,
      estimatedSavings: sum(unusedExpensiveModels.map((row) => row.baseline_cost_usd)) / 14,
      difficulty: "low",
      affectedModels: unusedExpensiveModels.slice(0, 5).map((row) => row.resource),
      affectedEndpoints: [],
      supportingMetrics: { historicalCost: sum(unusedExpensiveModels.map((row) => row.baseline_cost_usd)) }
    });
  }

  return dedupeRecommendations(recommendations).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

function topModels(rows: Array<{ model: string; cost_usd: number }>, limit: number): string[] {
  return [...rows].sort((a, b) => b.cost_usd - a.cost_usd).slice(0, limit).map((row) => row.model);
}

function topEndpoints(rows: Array<{ route: string; cost_usd: number }>, limit: number): string[] {
  return [...rows].sort((a, b) => b.cost_usd - a.cost_usd).slice(0, limit).map((row) => row.route);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length > 0 ? sum(finite) / finite.length : 0;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const weight = sum(values.map((item) => item.weight));
  return weight > 0 ? sum(values.map((item) => item.value * item.weight)) / weight : 0;
}

function providerCostShareMean(rows: Array<{ current_cost_usd: number }>, totalCost: number): number {
  return rows.length > 0 && totalCost > 0 ? mean(rows.map((row) => row.current_cost_usd / totalCost)) : 1;
}

function safeRate(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}

function confidenceFromSamples(samples: number, total: number): number {
  if (total <= 0) return 0.3;
  return clamp(0.45 + (samples / total) * 0.5, 0.35, 0.95);
}

function priorityFromShare(value: number, total: number): RecommendationPriority {
  const share = total > 0 ? value / total : 0;
  if (share >= 0.65) return "critical";
  if (share >= 0.35) return "high";
  if (share >= 0.15) return "medium";
  return "low";
}

function priorityRank(priority: RecommendationPriority): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[priority];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dedupeRecommendations(items: IntelligenceRecommendation[]): IntelligenceRecommendation[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

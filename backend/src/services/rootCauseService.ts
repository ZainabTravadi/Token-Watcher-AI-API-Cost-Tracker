import { buildAnalyticsSnapshot } from "./analyticsService";
import { generateInsightsWithGemini } from "./geminiService";
import type { IntelligenceAnomaly } from "./anomalyService";

export interface RootCauseRequest {
  anomaly: IntelligenceAnomaly;
}

export interface RootCauseAnalysis {
  rootCause: string;
  evidence: string[];
  impact: string;
  confidence: number;
  recommendedFix: string;
  affectedModels: string[];
  affectedEndpoints: string[];
  affectedProviders: string[];
}

export async function analyzeRootCause(workspaceId: string, anomaly: IntelligenceAnomaly): Promise<RootCauseAnalysis> {
  const snapshot = await buildAnalyticsSnapshot(workspaceId);
  const affectedModels = snapshot.models
    .filter((row) => isRelated(row.model, anomaly.affectedResource.id) || row.cost_usd > average(snapshot.models.map((item) => item.cost_usd)))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 5)
    .map((row) => row.model);
  const affectedEndpoints = snapshot.endpoints
    .filter((row) => isRelated(row.route, anomaly.affectedResource.id) || row.cost_usd > average(snapshot.endpoints.map((item) => item.cost_usd)))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 5)
    .map((row) => row.route);
  const affectedProviders = snapshot.models
    .filter((row) => isRelated(row.provider, anomaly.affectedResource.id) || affectedModels.includes(row.model))
    .map((row) => row.provider)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 5);

  const heuristic = buildHeuristicAnalysis(anomaly, affectedModels, affectedEndpoints, affectedProviders);

  try {
    const insights = await generateInsightsWithGemini({
      task: "rootCauseAnalysis",
      anomaly,
      analytics: {
        overview: snapshot.overview,
        topModels: snapshot.models.slice(0, 5),
        topEndpoints: snapshot.endpoints.slice(0, 5),
        recent: snapshot.recent.slice(0, 5)
      }
    });

    return {
      ...heuristic,
      rootCause: insights[0] ?? heuristic.rootCause,
      evidence: [...heuristic.evidence, ...insights.slice(1, 3)].slice(0, 5),
      confidence: Math.max(heuristic.confidence, anomaly.confidence)
    };
  } catch {
    return heuristic;
  }
}

export function validateRootCauseRequest(body: unknown): RootCauseRequest {
  if (!body || typeof body !== "object" || !("anomaly" in body)) {
    throw new Error("anomaly is required");
  }
  const anomaly = (body as { anomaly?: Partial<IntelligenceAnomaly> }).anomaly;
  if (!anomaly || typeof anomaly !== "object") {
    throw new Error("anomaly must be an object");
  }
  if (typeof anomaly.id !== "string" || typeof anomaly.title !== "string" || typeof anomaly.description !== "string") {
    throw new Error("anomaly id, title, and description are required");
  }
  if (!anomaly.affectedResource || typeof anomaly.affectedResource.id !== "string" || typeof anomaly.affectedResource.type !== "string") {
    throw new Error("anomaly affectedResource is required");
  }

  return {
    anomaly: {
      id: anomaly.id,
      severity: anomaly.severity === "critical" || anomaly.severity === "high" || anomaly.severity === "medium" || anomaly.severity === "low" ? anomaly.severity : "medium",
      confidence: typeof anomaly.confidence === "number" ? anomaly.confidence : 0.5,
      title: anomaly.title,
      description: anomaly.description,
      affectedResource: {
        type: anomaly.affectedResource.type as IntelligenceAnomaly["affectedResource"]["type"],
        id: anomaly.affectedResource.id
      },
      supportingData: isRecord(anomaly.supportingData) ? anomaly.supportingData as Record<string, number | string> : {},
      recommendedAction: typeof anomaly.recommendedAction === "string" ? anomaly.recommendedAction : "Review the affected AI traffic.",
      timestamp: typeof anomaly.timestamp === "number" ? anomaly.timestamp : Date.now()
    }
  };
}

function buildHeuristicAnalysis(
  anomaly: IntelligenceAnomaly,
  affectedModels: string[],
  affectedEndpoints: string[],
  affectedProviders: string[]
): RootCauseAnalysis {
  const rootCauseByType: Record<string, string> = {
    "cost-spike": "Recent traffic shifted toward higher-cost models, token-heavy requests, or higher-volume endpoints.",
    "latency-spike": "Recent requests are slower than the historical baseline, likely concentrated in the affected endpoint or model path.",
    "error-spike": "Recent failures are above baseline and may be amplified by retry or timeout behavior.",
    "token-spike": "Prompt or context payload size increased relative to historical usage.",
    "budget-risk": "Current spend rate is projected to exceed budget based on observed telemetry."
  };

  return {
    rootCause: rootCauseByType[anomaly.id] ?? `${anomaly.affectedResource.id} degraded relative to its historical baseline.`,
    evidence: [
      anomaly.description,
      `Affected resource: ${anomaly.affectedResource.type}:${anomaly.affectedResource.id}`,
      `Confidence: ${Math.round(anomaly.confidence * 100)}%`
    ],
    impact: `${anomaly.severity} severity impact on AI cost, reliability, or performance.`,
    confidence: anomaly.confidence,
    recommendedFix: anomaly.recommendedAction,
    affectedModels,
    affectedEndpoints,
    affectedProviders
  };
}

function average(values: number[]): number {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0;
}

function isRelated(value: string, target: string): boolean {
  return value.toLowerCase() === target.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

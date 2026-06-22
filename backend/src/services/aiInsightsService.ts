import { getAnalyticsSnapshot } from "./telemetryRepository";
import { generateInsightsWithGemini } from "./geminiService";

export interface AnalyticsSummary {
  totalSpend: number;
  budget: number | null;
  providerBreakdown: Record<string, number>;
  topModels: Record<string, number>;
  averageLatency: number | null;
  failureRate: number | null;
}

export async function buildAnalyticsSummary(workspaceId: string): Promise<AnalyticsSummary> {
  const snapshot = await getAnalyticsSnapshot(workspaceId, 24);

  const totalSpend = snapshot.models.reduce((sum, m) => sum + (m.cost_usd ?? 0), 0);
  const budget = snapshot.overview?.budget ?? null;

  const providerBreakdown: Record<string, number> = {};
  for (const m of snapshot.models) {
    providerBreakdown[m.provider] = (providerBreakdown[m.provider] ?? 0) + (m.cost_usd ?? 0);
  }

  const topModels: Record<string, number> = {};
  for (const m of snapshot.models) {
    topModels[m.model] = (topModels[m.model] ?? 0) + (m.cost_usd ?? 0);
  }

  // average latency weighted by requests
  let totalLatency = 0;
  let totalRequests = 0;
  for (const m of snapshot.models) {
    totalLatency += (m.avg_latency_ms ?? 0) * (m.requests ?? 0);
    totalRequests += m.requests ?? 0;
  }

  const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : null;
  const failureRate = snapshot.overview ? snapshot.overview.errorRate : null;

  return {
    totalSpend,
    budget,
    providerBreakdown,
    topModels,
    averageLatency,
    failureRate
  };
}

export async function generateInsightsForWorkspace(workspaceId: string): Promise<{ insights: string[]; summary: AnalyticsSummary }> {
  console.log('[AI INSIGHTS] Building analytics summary for workspace', workspaceId);
  const summary = await buildAnalyticsSummary(workspaceId);
  const payload = {
    totalSpend: summary.totalSpend,
    budget: summary.budget,
    providerBreakdown: summary.providerBreakdown,
    topModels: summary.topModels,
    averageLatency: summary.averageLatency,
    failureRate: summary.failureRate
  };

  console.log('[AI INSIGHTS] Sending analytics payload to Gemini service');
  const insights = await generateInsightsWithGemini(payload);
  console.log('[AI INSIGHTS] Insights generated count:', insights.length);

  return { insights, summary };
}

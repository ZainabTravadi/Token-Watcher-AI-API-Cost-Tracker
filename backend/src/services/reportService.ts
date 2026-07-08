import { buildAnalyticsSnapshot } from "./analyticsService";
import { detectAnomalies, type IntelligenceAnomaly } from "./anomalyService";
import { calculateEfficiencyScore, type EfficiencyScoreResponse } from "./efficiencyScoreService";
import { generateForecast, type ForecastResponse } from "./forecastService";
import { generateInsightsWithGemini } from "./geminiService";
import { generateRecommendations, type IntelligenceRecommendation } from "./recommendationService";
import { generatePdfFromLines } from "./pdfGeneratorService";
import type { AnalyticsEndpointRow, AnalyticsModelRow, AnalyticsSnapshot } from "../types/telemetry";

export type ReportType = "executive" | "weekly" | "monthly" | "budget" | "infrastructure" | "ai-usage" | "optimization" | "governance";
export type ExportFormat = "json" | "csv" | "pdf";

export interface ReportKeyMetric {
  name: string;
  value: number | string;
  unit?: string;
}

export interface CostAnalysis {
  totalSpend: number;
  budget: number;
  budgetUtilization: number;
  avgCostPerRequest: number;
  topCostDrivers: Array<{ name: string; cost: number; share: number }>;
}

export interface ProviderAnalysis {
  providers: Array<{ provider: string; spend: number; requests: number; share: number }>;
}

export interface ModelAnalysis {
  models: AnalyticsModelRow[];
}

export interface EndpointAnalysis {
  endpoints: AnalyticsEndpointRow[];
}

export interface ExecutiveReport {
  id: string;
  type: ReportType;
  generatedAt: string;
  workspaceId: string;
  summary: string;
  keyMetrics: ReportKeyMetric[];
  costAnalysis: CostAnalysis;
  providerAnalysis: ProviderAnalysis;
  modelAnalysis: ModelAnalysis;
  endpointAnalysis: EndpointAnalysis;
  anomalies: IntelligenceAnomaly[];
  recommendations: IntelligenceRecommendation[];
  efficiencyScore: EfficiencyScoreResponse;
  forecast: ForecastResponse;
  actionItems: string[];
  aiSummary: string[];
}

interface ReportContext {
  snapshot: AnalyticsSnapshot;
  recommendations: IntelligenceRecommendation[];
  anomalies: IntelligenceAnomaly[];
  efficiencyScore: EfficiencyScoreResponse;
  forecast: ForecastResponse;
}

const REPORT_CACHE_TTL_MS = 5 * 60 * 1000;
const reportCache = new Map<string, { expiresAt: number; value: ExecutiveReport }>();

export async function generateReport(workspaceId: string, type: ReportType): Promise<ExecutiveReport> {
  const cacheKey = `${workspaceId}:${type}`;
  const cached = reportCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const context = await buildReportContext(workspaceId);
  const aiSummary = await buildAiSummary(type, context);
  const report: ExecutiveReport = {
    id: `${type}-${workspaceId}-${Date.now()}`,
    type,
    generatedAt: new Date().toISOString(),
    workspaceId,
    summary: aiSummary[0] ?? buildFallbackSummary(type, context),
    keyMetrics: buildKeyMetrics(context),
    costAnalysis: buildCostAnalysis(context.snapshot),
    providerAnalysis: buildProviderAnalysis(context.snapshot),
    modelAnalysis: { models: context.snapshot.models.slice(0, 10) },
    endpointAnalysis: { endpoints: context.snapshot.endpoints.slice(0, 10) },
    anomalies: context.anomalies,
    recommendations: context.recommendations,
    efficiencyScore: context.efficiencyScore,
    forecast: context.forecast,
    actionItems: buildActionItems(context),
    aiSummary
  };

  reportCache.set(cacheKey, { expiresAt: Date.now() + REPORT_CACHE_TTL_MS, value: report });
  return report;
}

export async function exportReport(workspaceId: string, type: ReportType, format: ExportFormat): Promise<{ contentType: string; filename: string; body: string | Buffer }> {
  const report = await generateReport(workspaceId, type);
  const basename = `tokenwatch-${type}-report-${new Date().toISOString().slice(0, 10)}`;
  if (format === "json") {
    return {
      contentType: "application/json",
      filename: `${basename}.json`,
      body: JSON.stringify(report, null, 2)
    };
  }
  if (format === "csv") {
    return {
      contentType: "text/csv",
      filename: `${basename}.csv`,
      body: reportToCsv(report)
    };
  }
  return {
    contentType: "application/pdf",
    filename: `${basename}.pdf`,
    body: reportToPdf(report)
  };
}

export function parseReportType(value: unknown): ReportType {
  const candidate = typeof value === "string" ? value : "executive";
  const allowed: ReportType[] = ["executive", "weekly", "monthly", "budget", "infrastructure", "ai-usage", "optimization", "governance"];
  return allowed.includes(candidate as ReportType) ? candidate as ReportType : "executive";
}

export function parseExportFormat(value: unknown): ExportFormat {
  if (value === "csv" || value === "pdf" || value === "json") return value;
  return "json";
}

async function buildReportContext(workspaceId: string): Promise<ReportContext> {
  const [snapshot, recommendations, anomalies, efficiencyScore, forecast] = await Promise.all([
    buildAnalyticsSnapshot(workspaceId),
    generateRecommendations(workspaceId),
    detectAnomalies(workspaceId),
    calculateEfficiencyScore(workspaceId),
    generateForecast(workspaceId)
  ]);
  return { snapshot, recommendations, anomalies, efficiencyScore, forecast };
}

async function buildAiSummary(type: ReportType, context: ReportContext): Promise<string[]> {
  try {
    return await generateInsightsWithGemini({
      task: "reportSummary",
      reportType: type,
      overview: context.snapshot.overview,
      efficiencyScore: context.efficiencyScore.overallScore,
      forecast: context.forecast,
      anomalyCount: context.anomalies.length,
      recommendations: context.recommendations.slice(0, 5)
    });
  } catch {
    return [buildFallbackSummary(type, context)];
  }
}

function buildFallbackSummary(type: ReportType, context: ReportContext): string {
  return `${titleCase(type)} report: ${context.snapshot.overview.requestsToday} requests, ${roundMoney(context.snapshot.overview.spendToday)} spend today, efficiency score ${context.efficiencyScore.overallScore}.`;
}

function buildKeyMetrics(context: ReportContext): ReportKeyMetric[] {
  const overview = context.snapshot.overview;
  return [
    { name: "Spend Today", value: roundMoney(overview.spendToday), unit: "USD" },
    { name: "Requests Today", value: overview.requestsToday },
    { name: "Average Cost Per Request", value: roundMoney(overview.avgCostPerRequest), unit: "USD" },
    { name: "Error Rate", value: Math.round(overview.errorRate * 10000) / 100, unit: "%" },
    { name: "Efficiency Score", value: context.efficiencyScore.overallScore },
    { name: "Monthly Spend Forecast", value: context.forecast.predictedSpend.monthly, unit: "USD" }
  ];
}

function buildCostAnalysis(snapshot: AnalyticsSnapshot): CostAnalysis {
  const totalSpend = snapshot.models.reduce((sum, row) => sum + row.cost_usd, 0);
  return {
    totalSpend: roundMoney(totalSpend),
    budget: snapshot.overview.budget,
    budgetUtilization: snapshot.overview.budget > 0 ? roundRatio(totalSpend / snapshot.overview.budget) : 0,
    avgCostPerRequest: roundMoney(snapshot.overview.avgCostPerRequest),
    topCostDrivers: snapshot.models.slice(0, 5).map((row) => ({
      name: `${row.provider}/${row.model}`,
      cost: roundMoney(row.cost_usd),
      share: totalSpend > 0 ? roundRatio(row.cost_usd / totalSpend) : 0
    }))
  };
}

function buildProviderAnalysis(snapshot: AnalyticsSnapshot): ProviderAnalysis {
  const totalSpend = snapshot.models.reduce((sum, row) => sum + row.cost_usd, 0);
  const providers = new Map<string, { provider: string; spend: number; requests: number }>();
  for (const model of snapshot.models) {
    const current = providers.get(model.provider) ?? { provider: model.provider, spend: 0, requests: 0 };
    current.spend += model.cost_usd;
    current.requests += model.requests;
    providers.set(model.provider, current);
  }
  return {
    providers: [...providers.values()].sort((a, b) => b.spend - a.spend).map((row) => ({
      provider: row.provider,
      spend: roundMoney(row.spend),
      requests: row.requests,
      share: totalSpend > 0 ? roundRatio(row.spend / totalSpend) : 0
    }))
  };
}

function buildActionItems(context: ReportContext): string[] {
  const recommended = context.recommendations.slice(0, 5).map((item) => item.title);
  const anomalyActions = context.anomalies.slice(0, 3).map((item) => item.recommendedAction);
  const efficiencyActions = context.efficiencyScore.improvementSuggestions.slice(0, 3);
  return [...recommended, ...anomalyActions, ...efficiencyActions].filter(Boolean).slice(0, 10);
}

function reportToCsv(report: ExecutiveReport): string {
  const rows: Array<Record<string, string | number>> = [
    { section: "summary", metric: "reportType", value: report.type },
    { section: "summary", metric: "generatedAt", value: report.generatedAt },
    ...report.keyMetrics.map((metric) => ({ section: "keyMetrics", metric: metric.name, value: metric.value, unit: metric.unit ?? "" })),
    { section: "forecast", metric: "dailySpend", value: report.forecast.predictedSpend.daily },
    { section: "forecast", metric: "weeklySpend", value: report.forecast.predictedSpend.weekly },
    { section: "forecast", metric: "monthlySpend", value: report.forecast.predictedSpend.monthly },
    { section: "efficiency", metric: "overallScore", value: report.efficiencyScore.overallScore },
    { section: "anomalies", metric: "count", value: report.anomalies.length },
    { section: "recommendations", metric: "count", value: report.recommendations.length }
  ];
  const headers = ["section", "metric", "value", "unit"];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","))].join("\n");
}

function reportToPdf(report: ExecutiveReport): Buffer {
  const lines = [
    "TokenWatcher Report",
    `Type: ${report.type}`,
    `Generated: ${report.generatedAt}`,
    "",
    "Summary",
    report.summary,
    "",
    "Key Metrics",
    ...report.keyMetrics.map((metric) => `${metric.name}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`),
    "",
    "Action Items",
    ...report.actionItems.map((item, index) => `${index + 1}. ${item}`)
  ];
  return generatePdfFromLines(lines);
}







function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function titleCase(value: string): string {
  return value.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

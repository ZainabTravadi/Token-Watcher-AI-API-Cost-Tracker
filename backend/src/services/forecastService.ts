import { buildAnalyticsSnapshot } from "./analyticsService";
import { listTelemetryHistoryBuckets, type TelemetryHistoryBucket } from "./telemetryRepository";

export interface ForecastPeriod {
  start: number;
  end: number;
  label: "daily" | "weekly" | "monthly";
}

export interface ForecastResponse {
  currentPeriod: ForecastPeriod;
  predictedSpend: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  predictedRequests: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  predictedTokens: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  predictedBudgetDate: string | null;
  confidence: number;
  forecastMethod: string;
  historicalWindow: {
    hours: number;
    bucketHours: number;
    samples: number;
  };
  expectedCostTrend: "decreasing" | "flat" | "increasing";
}

const FORECAST_CACHE_TTL_MS = 5 * 60 * 1000;
const forecastCache = new Map<string, { expiresAt: number; value: ForecastResponse }>();

export async function generateForecast(workspaceId: string): Promise<ForecastResponse> {
  const cached = forecastCache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const hours = 336;
  const bucketHours = 24;
  const [snapshot, buckets] = await Promise.all([
    buildAnalyticsSnapshot(workspaceId),
    listTelemetryHistoryBuckets(workspaceId, hours, bucketHours)
  ]);
  const usableBuckets = buckets.filter((bucket) => bucket.requests > 0 || bucket.cost_usd > 0);
  const dailySpend = forecastMetric(usableBuckets.map((bucket) => bucket.cost_usd));
  const dailyRequests = forecastMetric(usableBuckets.map((bucket) => bucket.requests));
  const dailyTokens = forecastMetric(usableBuckets.map((bucket) => bucket.avg_total_tokens * bucket.requests));
  const now = Date.now();
  const period = currentDailyPeriod(now);
  const budgetDate = predictBudgetDate(snapshot.overview.budget, snapshot.overview.spendToday, dailySpend.predicted);
  const confidence = Math.round((dailySpend.confidence + dailyRequests.confidence + dailyTokens.confidence) / 3);

  const value: ForecastResponse = {
    currentPeriod: period,
    predictedSpend: {
      daily: roundMoney(dailySpend.predicted),
      weekly: roundMoney(dailySpend.predicted * 7),
      monthly: roundMoney(dailySpend.predicted * daysInCurrentMonth())
    },
    predictedRequests: {
      daily: Math.round(dailyRequests.predicted),
      weekly: Math.round(dailyRequests.predicted * 7),
      monthly: Math.round(dailyRequests.predicted * daysInCurrentMonth())
    },
    predictedTokens: {
      daily: Math.round(dailyTokens.predicted),
      weekly: Math.round(dailyTokens.predicted * 7),
      monthly: Math.round(dailyTokens.predicted * daysInCurrentMonth())
    },
    predictedBudgetDate: budgetDate,
    confidence,
    forecastMethod: "weighted moving average with linear trend adjustment",
    historicalWindow: {
      hours,
      bucketHours,
      samples: usableBuckets.length
    },
    expectedCostTrend: trendLabel(dailySpend.slope)
  };

  forecastCache.set(workspaceId, { expiresAt: Date.now() + FORECAST_CACHE_TTL_MS, value });
  return value;
}

export async function generateSpendForecast(workspaceId: string): Promise<Pick<ForecastResponse, "currentPeriod" | "predictedSpend" | "predictedBudgetDate" | "confidence" | "forecastMethod" | "historicalWindow" | "expectedCostTrend">> {
  const forecast = await generateForecast(workspaceId);
  return {
    currentPeriod: forecast.currentPeriod,
    predictedSpend: forecast.predictedSpend,
    predictedBudgetDate: forecast.predictedBudgetDate,
    confidence: forecast.confidence,
    forecastMethod: forecast.forecastMethod,
    historicalWindow: forecast.historicalWindow,
    expectedCostTrend: forecast.expectedCostTrend
  };
}

export async function generateRequestForecast(workspaceId: string): Promise<Pick<ForecastResponse, "currentPeriod" | "predictedRequests" | "confidence" | "forecastMethod" | "historicalWindow">> {
  const forecast = await generateForecast(workspaceId);
  return {
    currentPeriod: forecast.currentPeriod,
    predictedRequests: forecast.predictedRequests,
    confidence: forecast.confidence,
    forecastMethod: forecast.forecastMethod,
    historicalWindow: forecast.historicalWindow
  };
}

export async function generateBudgetForecast(workspaceId: string): Promise<Pick<ForecastResponse, "currentPeriod" | "predictedSpend" | "predictedBudgetDate" | "confidence" | "forecastMethod" | "historicalWindow">> {
  const forecast = await generateForecast(workspaceId);
  return {
    currentPeriod: forecast.currentPeriod,
    predictedSpend: forecast.predictedSpend,
    predictedBudgetDate: forecast.predictedBudgetDate,
    confidence: forecast.confidence,
    forecastMethod: forecast.forecastMethod,
    historicalWindow: forecast.historicalWindow
  };
}

function forecastMetric(values: number[]): { predicted: number; confidence: number; slope: number } {
  const finite = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (finite.length === 0) {
    return { predicted: 0, confidence: 35, slope: 0 };
  }
  const weighted = weightedMovingAverage(finite);
  const slope = linearSlope(finite);
  const predicted = Math.max(0, weighted + slope);
  const avg = mean(finite);
  const volatility = avg > 0 ? stddev(finite, avg) / avg : 0;
  const sampleConfidence = Math.min(30, finite.length * 3);
  const confidence = clamp(Math.round(55 + sampleConfidence - volatility * 30), 35, 90);
  return { predicted, confidence, slope };
}

function weightedMovingAverage(values: number[]): number {
  const tail = values.slice(-7);
  const denominator = tail.reduce((sum, _value, index) => sum + index + 1, 0);
  if (denominator === 0) return 0;
  return tail.reduce((sum, value, index) => sum + value * (index + 1), 0) / denominator;
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = mean(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  return denominator > 0 ? numerator / denominator : 0;
}

function predictBudgetDate(budget: number, spendToday: number, predictedDailySpend: number): string | null {
  if (budget <= 0 || predictedDailySpend <= 0) return null;
  const remaining = budget - spendToday;
  if (remaining <= 0) return new Date().toISOString();
  const days = Math.ceil(remaining / predictedDailySpend);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function currentDailyPeriod(now: number): ForecastPeriod {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime(), label: "daily" };
}

function trendLabel(slope: number): ForecastResponse["expectedCostTrend"] {
  if (slope > 0.01) return "increasing";
  if (slope < -0.01) return "decreasing";
  return "flat";
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stddev(values: number[], avg: number): number {
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

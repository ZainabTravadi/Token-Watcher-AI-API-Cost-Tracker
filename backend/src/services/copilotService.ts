import { buildAnalyticsSnapshot } from "./analyticsService";
import { detectAnomalies, type IntelligenceAnomaly } from "./anomalyService";
import { calculateEfficiencyScore } from "./efficiencyScoreService";
import { generateForecast } from "./forecastService";
import { generateInsightsWithGemini } from "./geminiService";
import { generateRecommendations } from "./recommendationService";
import { generateReport, type ExecutiveReport, type ReportType } from "./reportService";
import { analyzeRootCause } from "./rootCauseService";
import { listRequestLogRecords } from "./requestService";

export type CopilotRole = "executive-analyst" | "devops-engineer" | "finops-analyst" | "cto" | "engineering-manager";
export type CopilotToolName =
  | "getAnalyticsSnapshot"
  | "getRecommendations"
  | "getForecast"
  | "getEfficiencyScore"
  | "getAnomalies"
  | "getRootCause"
  | "generateExecutiveReport"
  | "generateWeeklyReport"
  | "generateBudgetReport"
  | "searchTelemetry"
  | "searchModels"
  | "searchEndpoints";

export interface CopilotMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

export interface CopilotRequest {
  conversationId?: string;
  message: string;
  role?: CopilotRole;
  contextWindow?: number;
}

export interface CopilotToolResult {
  name: CopilotToolName;
  data: unknown;
}

export interface CopilotResponse {
  conversationId: string;
  answer: string;
  confidence: number;
  sourceMetrics: CopilotToolResult[];
  toolsUsed: CopilotToolName[];
  historySummary: string | null;
}

interface ConversationState {
  id: string;
  workspaceId: string;
  messages: CopilotMessage[];
  summary: string | null;
  updatedAt: number;
}

const DEFAULT_CONTEXT_WINDOW = 12;
const MAX_CONTEXT_MESSAGES = 24;
const conversationStore = new Map<string, ConversationState>();
const responseCache = new Map<string, { expiresAt: number; value: CopilotResponse }>();
const RESPONSE_CACHE_TTL_MS = 2 * 60 * 1000;

const prompts: Record<CopilotRole, string> = {
  "executive-analyst": "You are an executive analyst. Answer with business impact, risks, and decisions. Never invent numbers. Use only provided tool outputs.",
  "devops-engineer": "You are a DevOps engineer. Answer with operational signals, reliability risks, and concrete remediation. Never invent numbers. Use only provided tool outputs.",
  "finops-analyst": "You are a FinOps analyst. Answer with cost, budget, forecast, and savings detail. Never invent numbers. Use only provided tool outputs.",
  cto: "You are a CTO advisor. Answer with strategic tradeoffs, technical risk, and prioritized action. Never invent numbers. Use only provided tool outputs.",
  "engineering-manager": "You are an engineering manager. Answer with team actions, ownership, and delivery priorities. Never invent numbers. Use only provided tool outputs."
};

export async function runCopilotChat(workspaceId: string, input: CopilotRequest): Promise<CopilotResponse> {
  const request = validateCopilotRequest(input);
  const conversation = getConversation(workspaceId, request.conversationId);
  const contextWindow = clamp(Math.trunc(request.contextWindow ?? DEFAULT_CONTEXT_WINDOW), 4, MAX_CONTEXT_MESSAGES);
  conversation.messages.push({ role: "user", content: request.message, createdAt: Date.now() });
  summarizeConversationIfNeeded(conversation, contextWindow);

  const cacheKey = `${workspaceId}:${request.role}:${request.message}:${conversation.summary ?? ""}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const tools = selectTools(request.message);
  const sourceMetrics = await runTools(workspaceId, tools, request.message);
  const answer = await generateGroundedAnswer(request.role, request.message, conversation, sourceMetrics);
  const response: CopilotResponse = {
    conversationId: conversation.id,
    answer,
    confidence: calculateConfidence(sourceMetrics),
    sourceMetrics,
    toolsUsed: sourceMetrics.map((result) => result.name),
    historySummary: conversation.summary
  };

  conversation.messages.push({ role: "assistant", content: answer, createdAt: Date.now() });
  conversation.updatedAt = Date.now();
  responseCache.set(cacheKey, { expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS, value: response });
  return response;
}

export async function runCopilotReport(workspaceId: string, type: ReportType = "executive", input: Partial<CopilotRequest> = {}): Promise<CopilotResponse> {
  const report = await generateReport(workspaceId, type);
  const sourceMetrics: CopilotToolResult[] = [{ name: reportToolName(type), data: report }];
  return buildDirectResponse(workspaceId, input, `Generated ${type} report using backend report service. Summary: ${report.summary}`, sourceMetrics);
}

export async function runCopilotExplain(workspaceId: string, anomaly: IntelligenceAnomaly | undefined, input: Partial<CopilotRequest> = {}): Promise<CopilotResponse> {
  const anomalies = anomaly ? [anomaly] : await detectAnomalies(workspaceId);
  const target = anomalies[0];
  if (!target) {
    return buildDirectResponse(workspaceId, input, "No active anomaly was found in backend anomaly detection.", [{ name: "getAnomalies", data: anomalies }]);
  }
  const rootCause = await analyzeRootCause(workspaceId, target);
  return buildDirectResponse(workspaceId, input, `Root cause: ${rootCause.rootCause}. Recommended fix: ${rootCause.recommendedFix}`, [
    { name: "getAnomalies", data: anomalies },
    { name: "getRootCause", data: rootCause }
  ]);
}

export async function runCopilotForecast(workspaceId: string, input: Partial<CopilotRequest> = {}): Promise<CopilotResponse> {
  const forecast = await generateForecast(workspaceId);
  return buildDirectResponse(
    workspaceId,
    input,
    `Forecast generated from telemetry history. Monthly spend forecast is ${forecast.predictedSpend.monthly}; monthly request forecast is ${forecast.predictedRequests.monthly}; confidence is ${forecast.confidence}.`,
    [{ name: "getForecast", data: forecast }]
  );
}

export function validateCopilotRequest(input: unknown): Required<CopilotRequest> {
  if (!input || typeof input !== "object") {
    throw new Error("request body is required");
  }
  const body = input as Partial<CopilotRequest>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    throw new Error("message is required");
  }
  return {
    conversationId: typeof body.conversationId === "string" && body.conversationId.trim() ? body.conversationId.trim() : createConversationId(),
    message,
    role: isCopilotRole(body.role) ? body.role : "finops-analyst",
    contextWindow: typeof body.contextWindow === "number" ? body.contextWindow : DEFAULT_CONTEXT_WINDOW
  };
}

export function getCopilotPrompts(): Record<CopilotRole, string> {
  return { ...prompts };
}

async function buildDirectResponse(workspaceId: string, input: Partial<CopilotRequest>, answer: string, sourceMetrics: CopilotToolResult[]): Promise<CopilotResponse> {
  const conversation = getConversation(workspaceId, input.conversationId);
  conversation.messages.push({ role: "assistant", content: answer, createdAt: Date.now() });
  return {
    conversationId: conversation.id,
    answer,
    confidence: calculateConfidence(sourceMetrics),
    sourceMetrics,
    toolsUsed: sourceMetrics.map((result) => result.name),
    historySummary: conversation.summary
  };
}

async function runTools(workspaceId: string, tools: CopilotToolName[], message: string): Promise<CopilotToolResult[]> {
  const uniqueTools = [...new Set(tools)];
  const results: CopilotToolResult[] = [];
  for (const tool of uniqueTools) {
    results.push({ name: tool, data: await runTool(workspaceId, tool, message) });
  }
  return results;
}

async function runTool(workspaceId: string, tool: CopilotToolName, message: string): Promise<unknown> {
  switch (tool) {
    case "getAnalyticsSnapshot":
      return await buildAnalyticsSnapshot(workspaceId);
    case "getRecommendations":
      return await generateRecommendations(workspaceId);
    case "getForecast":
      return await generateForecast(workspaceId);
    case "getEfficiencyScore":
      return await calculateEfficiencyScore(workspaceId);
    case "getAnomalies":
      return await detectAnomalies(workspaceId);
    case "getRootCause": {
      const anomalies = await detectAnomalies(workspaceId);
      const anomaly = anomalies[0];
      return anomaly ? await analyzeRootCause(workspaceId, anomaly) : null;
    }
    case "generateExecutiveReport":
      return await generateReport(workspaceId, "executive");
    case "generateWeeklyReport":
      return await generateReport(workspaceId, "weekly");
    case "generateBudgetReport":
      return await generateReport(workspaceId, "budget");
    case "searchTelemetry":
      return await searchTelemetry(workspaceId, message);
    case "searchModels":
      return await searchModels(workspaceId, message);
    case "searchEndpoints":
      return await searchEndpoints(workspaceId, message);
  }
}

function selectTools(message: string): CopilotToolName[] {
  const text = message.toLowerCase();
  const tools = new Set<CopilotToolName>(["getAnalyticsSnapshot"]);
  if (/(recommend|optimi[sz]|saving|reduce|cheaper|cache|batch)/.test(text)) tools.add("getRecommendations");
  if (/(forecast|predict|projection|budget date|exhaust)/.test(text)) tools.add("getForecast");
  if (/(efficien|score|health)/.test(text)) tools.add("getEfficiencyScore");
  if (/(anomal|spike|degrad|incident|root cause|why|explain)/.test(text)) {
    tools.add("getAnomalies");
    tools.add("getRootCause");
  }
  if (/(executive|report|summary|board)/.test(text)) tools.add("generateExecutiveReport");
  if (/(weekly)/.test(text)) tools.add("generateWeeklyReport");
  if (/(budget)/.test(text)) tools.add("generateBudgetReport");
  if (/(request|telemetry|recent|log)/.test(text)) tools.add("searchTelemetry");
  if (/(model|gemini)/.test(text)) tools.add("searchModels");
  if (/(endpoint|route|api)/.test(text)) tools.add("searchEndpoints");
  if (tools.size === 1) {
    tools.add("getRecommendations");
    tools.add("getForecast");
    tools.add("getEfficiencyScore");
  }
  return [...tools];
}

async function generateGroundedAnswer(role: CopilotRole, message: string, conversation: ConversationState, sourceMetrics: CopilotToolResult[]): Promise<string> {
  const fallback = buildDeterministicAnswer(message, sourceMetrics);
  try {
    const lines = await generateInsightsWithGemini({
      task: "copilotAnswer",
      systemPrompt: prompts[role],
      safety: "Use only toolOutputs. If a number is not in toolOutputs, say it is unavailable. Return confidence and cite source tool names.",
      conversationSummary: conversation.summary,
      recentMessages: conversation.messages.slice(-DEFAULT_CONTEXT_WINDOW),
      userQuestion: message,
      toolOutputs: sourceMetrics.map((result) => ({
        name: result.name,
        data: compactToolData(result.data)
      }))
    });
    return lines.length > 0 ? lines.join("\n") : fallback;
  } catch {
    return fallback;
  }
}

function buildDeterministicAnswer(message: string, sourceMetrics: CopilotToolResult[]): string {
  const analytics = sourceMetrics.find((result) => result.name === "getAnalyticsSnapshot")?.data as any;
  const forecast = sourceMetrics.find((result) => result.name === "getForecast")?.data as any;
  const efficiency = sourceMetrics.find((result) => result.name === "getEfficiencyScore")?.data as any;
  const recommendations = sourceMetrics.find((result) => result.name === "getRecommendations")?.data as any[] | undefined;
  const anomalies = sourceMetrics.find((result) => result.name === "getAnomalies")?.data as any[] | undefined;
  const parts = [`Answering from backend metrics for: ${message}`];
  if (analytics?.overview) {
    parts.push(`Analytics: ${analytics.overview.requestsToday} requests today, ${analytics.overview.spendToday} spend today, ${analytics.overview.errorRate} error rate.`);
  }
  if (forecast) {
    parts.push(`Forecast: monthly spend ${forecast.predictedSpend?.monthly}, monthly requests ${forecast.predictedRequests?.monthly}, confidence ${forecast.confidence}.`);
  }
  if (efficiency) {
    parts.push(`Efficiency: overall score ${efficiency.overallScore}.`);
  }
  if (recommendations) {
    parts.push(`Top recommendations: ${recommendations.slice(0, 3).map((item) => item.title).join("; ") || "none"}.`);
  }
  if (anomalies) {
    parts.push(`Anomalies detected: ${anomalies.length}.`);
  }
  parts.push(`Sources: ${sourceMetrics.map((result) => result.name).join(", ")}.`);
  return parts.join("\n");
}

async function searchTelemetry(workspaceId: string, message: string): Promise<unknown> {
  const log = await listRequestLogRecords(workspaceId, { limit: 50 });
  const term = extractSearchTerm(message);
  const data = term
    ? log.data.filter((row) => `${row.route} ${row.model} ${row.provider} ${row.error ?? ""}`.toLowerCase().includes(term)).slice(0, 20)
    : log.data.slice(0, 20);
  return { total: log.total, returned: data.length, data };
}

async function searchModels(workspaceId: string, message: string): Promise<unknown> {
  const snapshot = await buildAnalyticsSnapshot(workspaceId);
  const term = extractSearchTerm(message);
  const models = term
    ? snapshot.models.filter((row) => `${row.model} ${row.provider}`.toLowerCase().includes(term))
    : snapshot.models;
  return models.slice(0, 20);
}

async function searchEndpoints(workspaceId: string, message: string): Promise<unknown> {
  const snapshot = await buildAnalyticsSnapshot(workspaceId);
  const term = extractSearchTerm(message);
  const endpoints = term
    ? snapshot.endpoints.filter((row) => row.route.toLowerCase().includes(term))
    : snapshot.endpoints;
  return endpoints.slice(0, 20);
}

function compactToolData(data: unknown): unknown {
  if (Array.isArray(data)) return data.slice(0, 10);
  if (!data || typeof data !== "object") return data;
  const value = data as Record<string, unknown>;
  return {
    overview: value.overview,
    predictedSpend: value.predictedSpend,
    predictedRequests: value.predictedRequests,
    overallScore: value.overallScore,
    summary: value.summary,
    keyMetrics: value.keyMetrics,
    items: Array.isArray(value.data) ? value.data.slice(0, 10) : undefined,
    topModels: Array.isArray(value.models) ? value.models.slice(0, 5) : undefined,
    topEndpoints: Array.isArray(value.endpoints) ? value.endpoints.slice(0, 5) : undefined
  };
}

function getConversation(workspaceId: string, conversationId?: string): ConversationState {
  const id = conversationId || createConversationId();
  const existing = conversationStore.get(id);
  if (existing && existing.workspaceId === workspaceId) {
    return existing;
  }
  const created: ConversationState = { id, workspaceId, messages: [], summary: null, updatedAt: Date.now() };
  conversationStore.set(id, created);
  return created;
}

function summarizeConversationIfNeeded(conversation: ConversationState, contextWindow: number): void {
  if (conversation.messages.length <= contextWindow) return;
  const overflow = conversation.messages.splice(0, conversation.messages.length - contextWindow);
  const previous = conversation.summary ? `${conversation.summary}\n` : "";
  conversation.summary = `${previous}${overflow.map((message) => `${message.role}: ${message.content}`).join("\n")}`.slice(-4000);
}

function calculateConfidence(sourceMetrics: CopilotToolResult[]): number {
  if (sourceMetrics.length === 0) return 0.2;
  const hasAnalytics = sourceMetrics.some((result) => result.name === "getAnalyticsSnapshot");
  const hasSpecialized = sourceMetrics.some((result) => result.name !== "getAnalyticsSnapshot");
  return hasAnalytics && hasSpecialized ? 0.86 : hasAnalytics ? 0.72 : 0.6;
}

function reportToolName(type: ReportType): CopilotToolName {
  if (type === "weekly") return "generateWeeklyReport";
  if (type === "budget") return "generateBudgetReport";
  return "generateExecutiveReport";
}

function extractSearchTerm(message: string): string {
  const quoted = message.match(/"([^"]+)"/)?.[1];
  if (quoted) return quoted.toLowerCase();
  return message.toLowerCase().split(/\s+/).find((word) => word.length > 4 && !STOP_WORDS.has(word)) ?? "";
}

function isCopilotRole(value: unknown): value is CopilotRole {
  return typeof value === "string" && value in prompts;
}

function createConversationId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const STOP_WORDS = new Set(["about", "forecast", "recommend", "recommendations", "explain", "report", "budget", "model", "endpoint", "request", "telemetry"]);

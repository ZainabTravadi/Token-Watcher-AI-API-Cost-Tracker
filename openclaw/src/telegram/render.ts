import type { ToolExecutionResult } from "../tokenwatcher/types";

function money(value: number | undefined): string {
  return typeof value === "number" ? `$${value.toFixed(2)}` : "n/a";
}

function percent(value: number | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function integer(value: number | undefined): string {
  return typeof value === "number" ? Math.round(value).toLocaleString("en-US") : "n/a";
}

function lineList(lines: string[]): string {
  return lines.join("\n");
}

function takeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function trimMessage(value: string): string {
  return value.length <= 3500 ? value : `${value.slice(0, 3497)}...`;
}

function renderNoTelemetry(title: string): string {
  return `*${title}*\nNo telemetry is available yet for this workspace.`;
}

function renderOverview(data: any): string {
  if (!data || typeof data !== "object") {
    return renderNoTelemetry("Today's Spend");
  }

  const requestsToday = typeof data.requestsToday === "number" ? data.requestsToday : 0;
  const spendToday = typeof data.spendToday === "number" ? data.spendToday : 0;
  if (requestsToday === 0 && spendToday === 0) {
    return renderNoTelemetry("Today's Spend");
  }

  return lineList([
    "*Today's Spend*",
    `Spend: ${money(data.spendToday)}`,
    `Requests: ${integer(data.requestsToday)}`,
    `Avg/request: ${money(data.avgCostPerRequest)}`,
    `Budget: ${money(data.budget)}`,
    `Error rate: ${percent(data.errorRate)}`
  ]);
}

function renderModels(data: unknown): string {
  const models = takeArray<any>(data);
  if (models.length === 0) {
    return renderNoTelemetry("Top Models");
  }

  const lines = models.slice(0, 5).map((row, index) =>
    `${index + 1}. \`${row.provider}/${row.model}\`  ${money(row.cost_usd)}  ${integer(row.requests)} req`
  );

  return lineList(["*Top Models*", ...lines]);
}

function renderEndpoints(data: unknown): string {
  const endpoints = takeArray<any>(data);
  if (endpoints.length === 0) {
    return renderNoTelemetry("Top Endpoints");
  }

  const lines = endpoints.slice(0, 5).map((row, index) =>
    `${index + 1}. \`${row.route}\`  ${money(row.cost_usd)}  ${integer(row.requests)} req`
  );

  return lineList(["*Top Endpoints*", ...lines]);
}

function renderRecent(data: unknown): string {
  const recent = takeArray<any>(data);
  if (recent.length === 0) {
    return renderNoTelemetry("Recent Requests");
  }

  const lines = recent.slice(0, 5).map((row) =>
    `- ${row.status}  ${money(row.cost)}  \`${row.endpoint}\`  ${row.model}`
  );

  return lineList(["*Recent Requests*", ...lines]);
}

function renderRequestsSearch(data: any): string {
  const rows = takeArray<any>(data?.data);
  if (rows.length === 0) {
    return renderNoTelemetry("Requests");
  }

  const lines = rows.slice(0, 5).map((row) => {
    const status = row.error ? (String(row.error).includes("429") ? "429" : String(row.error).includes("500") ? "500" : "ERR") : "200";
    return `- ${status}  ${money(row.cost_usd)}  \`${row.route}\`  ${row.model}`;
  });

  return lineList(["*Requests*", ...lines]);
}

function renderRecommendations(data: unknown): string {
  const items = takeArray<any>(data);
  if (items.length === 0) {
    return renderNoTelemetry("Recommendations");
  }

  const lines = items.slice(0, 3).map((item, index) =>
    `${index + 1}. *${item.title}*\nPriority: ${item.priority} | Savings: ${money(item.estimatedSavings)}`
  );

  return lineList(["*Recommendations*", ...lines]);
}

function renderForecast(data: any): string {
  if (!data || typeof data !== "object") {
    return renderNoTelemetry("Forecast");
  }

  if (data.historicalWindow?.samples === 0) {
    return renderNoTelemetry("Forecast");
  }

  return lineList([
    "*Forecast*",
    `Daily: ${money(data.predictedSpend?.daily)}`,
    `Weekly: ${money(data.predictedSpend?.weekly)}`,
    `Monthly: ${money(data.predictedSpend?.monthly)}`,
    `Trend: ${data.expectedCostTrend ?? "n/a"}`,
    `Confidence: ${typeof data.confidence === "number" ? `${data.confidence}%` : "n/a"}`,
    data.predictedBudgetDate ? `Budget date: ${String(data.predictedBudgetDate).slice(0, 10)}` : "Budget date: not projected"
  ]);
}

function renderBudget(data: any): string {
  const overview = data?.overview;
  const forecast = data?.forecast;
  if (!forecast || !overview) {
    return renderNoTelemetry("Budget Status");
  }

  if ((overview.requestsToday ?? 0) === 0 && (overview.spendToday ?? 0) === 0 && (forecast.historicalWindow?.samples ?? 0) === 0) {
    return renderNoTelemetry("Budget Status");
  }

  const budget = typeof overview.budget === "number" ? overview.budget : undefined;
  const monthlyForecast = typeof forecast.predictedSpend?.monthly === "number" ? forecast.predictedSpend.monthly : undefined;
  const budgetUtilization = budget && monthlyForecast !== undefined ? `${((monthlyForecast / budget) * 100).toFixed(1)}%` : "n/a";

  return lineList([
    "*Budget Status*",
    `Spend today: ${money(overview.spendToday)}`,
    `Monthly budget: ${money(budget)}`,
    `Forecasted monthly spend: ${money(monthlyForecast)}`,
    `Budget utilization: ${budgetUtilization}`,
    forecast.predictedBudgetDate ? `Budget exhaustion date: ${String(forecast.predictedBudgetDate).slice(0, 10)}` : "Budget exhaustion date: not projected",
    `Confidence: ${typeof forecast.confidence === "number" ? `${forecast.confidence}%` : "n/a"}`
  ]);
}

function renderReport(data: any): string {
  if (!data || typeof data !== "object") {
    return renderNoTelemetry("Report");
  }

  const title = typeof data.type === "string" ? `${data.type[0].toUpperCase()}${data.type.slice(1)} Report` : "Report";
  const keyMetrics = takeArray<any>(data.keyMetrics).slice(0, 3).map((metric) => `${metric.name}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`);
  const actions = takeArray<any>(data.actionItems).slice(0, 3).map((item, index) => `${index + 1}. ${item}`);
  const lines = [
    `*${title}*`,
    typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : "No summary available."
  ];

  if (keyMetrics.length > 0) {
    lines.push("", "*Key Metrics*", ...keyMetrics);
  }
  if (actions.length > 0) {
    lines.push("", "*Action Items*", ...actions);
  }

  return lineList(lines);
}

function renderCopilot(data: any): string {
  if (!data || typeof data !== "object" || typeof data.answer !== "string") {
    return "*Copilot*\nNo answer was returned.";
  }

  const lines = [
    "*Copilot*",
    data.answer.trim()
  ];
  if (typeof data.confidence === "number") {
    lines.push("", `Confidence: ${data.confidence}%`);
  }
  return lineList(lines);
}

function renderFallback(result: ToolExecutionResult): string {
  return lineList([
    "*TokenWatcher Response*",
    `Tool: ${result.tool}`,
    "A structured response was returned, but no custom formatter matched it yet."
  ]);
}

export function renderTelegramResponse(result: ToolExecutionResult): string {
  switch (result.tool) {
    case "analytics.overview":
      return trimMessage(renderOverview(result.data));
    case "analytics.models":
      return trimMessage(renderModels(result.data));
    case "analytics.endpoints":
      return trimMessage(renderEndpoints(result.data));
    case "analytics.recent":
      return trimMessage(renderRecent(result.data));
    case "forecast.full":
      return trimMessage(renderForecast(result.data));
    case "forecast.budget":
      return trimMessage(renderBudget(result.data));
    case "recommendations.list":
      return trimMessage(renderRecommendations(result.data));
    case "requests.search":
      return trimMessage(renderRequestsSearch(result.data));
    case "report.get":
      return trimMessage(renderReport(result.data));
    case "copilot.chat":
      return trimMessage(renderCopilot(result.data));
    default:
      return trimMessage(renderFallback(result));
  }
}

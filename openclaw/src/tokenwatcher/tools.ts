import type { Logger } from "../logger";
import { TokenWatcherClient } from "./client";
import type {
  CopilotChatInput,
  ReportInput,
  RequestSearchInput,
  ToolExecutionResult,
  ToolInvocation
} from "./types";

function positiveInteger(value: number | undefined, fallback: number, label: string): number {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return candidate;
}

function optionalDate(value: string | undefined, label: string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format`);
  }
  return value;
}

function requireMessage(message: string | undefined): string {
  if (!message?.trim()) {
    throw new Error("message is required");
  }
  return message.trim();
}

export class TokenWatcherToolRegistry {
  constructor(
    private readonly client: TokenWatcherClient,
    private readonly logger: Logger
  ) {}

  async execute(invocation: ToolInvocation): Promise<ToolExecutionResult> {
    this.logger.info("tool.execute", { tool: invocation.name });

    switch (invocation.name) {
      case "workspace.get":
        return this.getWorkspace();
      case "analytics.overview":
        return this.getAnalyticsOverview();
      case "analytics.models":
        return this.getTopModels();
      case "analytics.endpoints":
        return this.getTopEndpoints();
      case "analytics.recent":
        return this.getRecentAnalytics();
      case "analytics.snapshot":
        return this.getAnalyticsSnapshot();
      case "forecast.full":
        return this.getForecast();
      case "forecast.budget":
        return this.getBudgetForecast();
      case "report.get":
        return this.getReport(invocation.input as ReportInput);
      case "recommendations.list":
        return this.getRecommendations();
      case "requests.search":
        return this.searchRequests(invocation.input as RequestSearchInput);
      case "copilot.chat":
        return this.chatWithCopilot(invocation.input as CopilotChatInput);
      default:
        throw new Error(`Unsupported tool: ${(invocation as ToolInvocation).name}`);
    }
  }

  private async getWorkspace(): Promise<ToolExecutionResult> {
    const route = "/api/workspaces/current";
    const response = await this.client.getJson<{ data?: unknown } | unknown>(route);
    return {
      tool: "workspace.get",
      route,
      data: response
    };
  }

  private async getAnalyticsSnapshot(): Promise<ToolExecutionResult> {
    const route = "/api/analytics/snapshot";
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "analytics.snapshot",
      route,
      data: response.data
    };
  }

  private async getAnalyticsOverview(): Promise<ToolExecutionResult> {
    const route = "/api/analytics/overview";
    this.logger.info("tool.analytics.overview.enter", { route });
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "analytics.overview",
      route,
      data: response.data
    };
  }

  private async getTopModels(): Promise<ToolExecutionResult> {
    const route = "/api/analytics/models";
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "analytics.models",
      route,
      data: response.data
    };
  }

  private async getTopEndpoints(): Promise<ToolExecutionResult> {
    const route = "/api/analytics/endpoints";
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "analytics.endpoints",
      route,
      data: response.data
    };
  }

  private async getRecentAnalytics(): Promise<ToolExecutionResult> {
    const route = "/api/analytics/recent";
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "analytics.recent",
      route,
      data: response.data
    };
  }

  private async getForecast(): Promise<ToolExecutionResult> {
    const route = "/api/forecast";
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "forecast.full",
      route,
      data: response.data
    };
  }

  private async getBudgetForecast(): Promise<ToolExecutionResult> {
    const route = "/api/forecast/budget";
    const [forecast, overview] = await Promise.all([
      this.client.getJson<{ data: unknown }>(route),
      this.client.getJson<{ data: unknown }>("/api/analytics/overview")
    ]);
    return {
      tool: "forecast.budget",
      route,
      data: {
        forecast: forecast.data,
        overview: overview.data
      }
    };
  }

  private async getReport(input: ReportInput): Promise<ToolExecutionResult> {
    const validTypes = new Set(["executive", "weekly", "monthly", "budget", "infrastructure", "optimization", "governance"]);
    if (!validTypes.has(input.type)) {
      throw new Error("report type is invalid");
    }

    const route = `/api/reports/${input.type}`;
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "report.get",
      route,
      data: response.data
    };
  }

  private async getRecommendations(): Promise<ToolExecutionResult> {
    const route = "/api/intelligence/recommendations";
    const response = await this.client.getJson<{ data: unknown }>(route);
    return {
      tool: "recommendations.list",
      route,
      data: response.data
    };
  }

  private async searchRequests(input: RequestSearchInput): Promise<ToolExecutionResult> {
    const limit = positiveInteger(input.limit, 5, "limit");
    const page = positiveInteger(input.page, 1, "page");
    const route = "/api/requests";
    const response = await this.client.getJson<{ data: unknown }>(route, {
      page,
      limit,
      search: input.search?.trim() || undefined,
      provider: input.provider?.trim() || undefined,
      from: optionalDate(input.from, "from"),
      to: optionalDate(input.to, "to"),
      status: input.status?.filter(Boolean).join(",") || undefined
    });

    return {
      tool: "requests.search",
      route,
      data: response.data
    };
  }

  private async chatWithCopilot(input: CopilotChatInput): Promise<ToolExecutionResult> {
    const message = requireMessage(input.message);
    const route = "/api/copilot/chat";
    const body: { message: string; role?: CopilotChatInput["role"] } = { message };
    if (input.role) {
      body.role = input.role;
    }
    const response = await this.client.postJson<{ data: unknown }>(route, body);
    return {
      tool: "copilot.chat",
      route,
      data: response.data
    };
  }
}

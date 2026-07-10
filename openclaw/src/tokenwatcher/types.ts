export type ToolName =
  | "workspace.get"
  | "analytics.snapshot"
  | "analytics.overview"
  | "analytics.models"
  | "analytics.endpoints"
  | "analytics.recent"
  | "forecast.full"
  | "forecast.budget"
  | "report.get"
  | "recommendations.list"
  | "requests.search"
  | "copilot.chat";

export interface ToolInvocation<TInput = unknown> {
  name: ToolName;
  input: TInput;
}

export interface ToolExecutionResult {
  tool: ToolName;
  route: string;
  data: unknown;
}

export interface RequestSearchInput {
  page?: number;
  limit?: number;
  search?: string;
  provider?: string;
  status?: string[];
  from?: string;
  to?: string;
}

export interface ReportInput {
  type: "executive" | "weekly" | "monthly" | "budget" | "infrastructure" | "optimization" | "governance";
}

export interface CopilotChatInput {
  message: string;
  role?: "executive-analyst" | "devops-engineer" | "finops-analyst" | "cto" | "engineering-manager";
}

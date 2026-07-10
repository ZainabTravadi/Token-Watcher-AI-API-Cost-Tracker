import type { ToolInvocation } from "../tokenwatcher/types";

function pickReportType(message: string): ToolInvocation["input"] {
  if (message.includes("weekly")) return { type: "weekly" };
  if (message.includes("monthly")) return { type: "monthly" };
  if (message.includes("budget")) return { type: "budget" };
  if (message.includes("infrastructure")) return { type: "infrastructure" };
  if (message.includes("optimization")) return { type: "optimization" };
  if (message.includes("governance")) return { type: "governance" };
  return { type: "executive" };
}

export function routeIntent(rawMessage: string): ToolInvocation {
  const message = rawMessage.trim().toLowerCase();

  if (!message) {
    return {
      name: "analytics.overview",
      input: {}
    };
  }

  if (/\b(why|explain|anomal(y|ies)|spike|increase|audit)\b/u.test(message) || /\bhow can i reduce costs\b/u.test(message)) {
    return {
      name: "copilot.chat",
      input: {
        message: rawMessage.trim(),
        role: /\b(anomal|spike|audit|infrastructure)\b/u.test(message) ? "devops-engineer" : "finops-analyst"
      }
    };
  }

  if (/\brecommendation|recommendations|optimiz(e|ation)\b/u.test(message)) {
    return {
      name: "recommendations.list",
      input: {}
    };
  }

  if (/\b(today'?s|todays|today)\s+spend\b/u.test(message) || /\bspend today\b/u.test(message)) {
    return {
      name: "analytics.overview",
      input: {}
    };
  }

  if (/\bweekly spend\b/u.test(message)) {
    return {
      name: "report.get",
      input: { type: "weekly" }
    };
  }

  if (/\bmonthly spend\b/u.test(message)) {
    return {
      name: "report.get",
      input: { type: "monthly" }
    };
  }

  if (/\brecent requests?\b/u.test(message) || /\bshow recent\b/u.test(message) || /\brecent logs\b/u.test(message)) {
    return {
      name: "analytics.recent",
      input: {}
    };
  }

  if (/\brequest|requests|log|logs\b/u.test(message)) {
    return {
      name: "requests.search",
      input: {
        page: 1,
        limit: 5,
        search: /\brequest|requests|log|logs\b/u.test(message) ? undefined : rawMessage.trim()
      }
    };
  }

  if (/\btop models?\b/u.test(message) || /\bmodels?\b/u.test(message)) {
    return {
      name: "analytics.models",
      input: {}
    };
  }

  if (/\btop endpoints?\b/u.test(message) || /\bendpoints?\b/u.test(message)) {
    return {
      name: "analytics.endpoints",
      input: {}
    };
  }

  if (/\binfrastructure report\b/u.test(message)) {
    return {
      name: "report.get",
      input: { type: "infrastructure" }
    };
  }

  if (/\bexecutive report\b/u.test(message)) {
    return {
      name: "report.get",
      input: { type: "executive" }
    };
  }

  if (/\bweekly report\b/u.test(message)) {
    return {
      name: "report.get",
      input: { type: "weekly" }
    };
  }

  if (/\bmonthly report\b/u.test(message)) {
    return {
      name: "report.get",
      input: { type: "monthly" }
    };
  }

  if (/\breport|summary|briefing\b/u.test(message)) {
    return {
      name: "report.get",
      input: pickReportType(message)
    };
  }

  if (/\bforecast\b/u.test(message)) {
    return {
      name: "forecast.full",
      input: {}
    };
  }

  if (/\bbudget\b/u.test(message)) {
    return {
      name: "forecast.budget",
      input: {}
    };
  }

  if (/\bworkspace|settings|quota\b/u.test(message)) {
    return {
      name: "workspace.get",
      input: {}
    };
  }

  return {
    name: "analytics.overview",
    input: {}
  };
}

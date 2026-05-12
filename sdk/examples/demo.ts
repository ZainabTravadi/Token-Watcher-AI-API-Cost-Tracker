import { TokenWatch } from "../src/index";

const apiUrl = process.env.TOKENWATCH_API_URL ?? "http://localhost:3001";

TokenWatch.init({
  apiUrl,
  projectId: process.env.TOKENWATCH_PROJECT_ID ?? "demo-app",
  endpoint: "/api/ingest",
  headers: {
    "X-TokenWatch-Demo": "true"
  }
});

TokenWatch.identify("demo-user", {
  plan: "starter",
  workspace: "acme-prod"
}).catch(() => undefined);

const controller = TokenWatch.startSimulation({
  provider: "openai",
  model: "gpt-4o",
  endpoint: "/api/chat",
  intervalMs: Number(process.env.TOKENWATCH_SIM_INTERVAL_MS ?? "4000")
});

process.on("SIGINT", () => {
  controller.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  controller.stop();
  process.exit(0);
});

setInterval(() => {
  void TokenWatch.track("request.completed", {
    properties: {
      route: "/api/chat",
      simulator: true
    }
  });
}, 12_000).unref?.();
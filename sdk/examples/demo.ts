import { TokenWatch } from "../src/index";

const apiUrl = process.env.TOKENWATCH_API_URL ?? "http://localhost:3001";

TokenWatch.init({
  apiUrl,
  apiKey: process.env.TOKENWATCH_API_KEY ?? "tw_sdk_replace_with_sdk_key",
  endpoint: "/ingest",
  debug: process.env.TOKENWATCH_DEBUG === "true",
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
  profile: "medium",
  intervalMs: Number(process.env.TOKENWATCH_SIM_INTERVAL_MS ?? "4000")
});

process.on("SIGINT", () => {
  controller.stop();
  void TokenWatch.flush().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  controller.stop();
  void TokenWatch.flush().finally(() => process.exit(0));
});

setInterval(() => {
  void TokenWatch.track("request.completed", {
    properties: {
      route: "/api/chat",
      simulator: true
    }
  });
}, 12_000).unref?.();

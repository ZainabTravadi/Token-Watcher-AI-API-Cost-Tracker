import { runCopilotChat, runCopilotForecast, runCopilotReport } from "../services/copilotService";

async function copilotServiceSmokeTest(workspaceId: string): Promise<void> {
  await runCopilotChat(workspaceId, { message: "What is our forecast and top recommendation?" });
  await runCopilotForecast(workspaceId, { message: "Forecast spend" });
  await runCopilotReport(workspaceId, "executive", { message: "Create executive report" });
}

void copilotServiceSmokeTest;

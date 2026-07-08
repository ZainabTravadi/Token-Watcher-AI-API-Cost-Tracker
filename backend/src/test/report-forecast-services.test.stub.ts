import { generateForecast } from "../services/forecastService";
import { exportReport, generateReport } from "../services/reportService";

async function reportForecastServicesSmokeTest(workspaceId: string): Promise<void> {
  await generateForecast(workspaceId);
  await generateReport(workspaceId, "executive");
  await exportReport(workspaceId, "executive", "json");
  await exportReport(workspaceId, "executive", "csv");
  await exportReport(workspaceId, "executive", "pdf");
}

void reportForecastServicesSmokeTest;

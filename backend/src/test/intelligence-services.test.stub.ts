import { detectAnomalies } from "../services/anomalyService";
import { calculateEfficiencyScore } from "../services/efficiencyScoreService";
import { generateRecommendations } from "../services/recommendationService";

async function intelligenceServicesSmokeTest(workspaceId: string): Promise<void> {
  await generateRecommendations(workspaceId);
  await calculateEfficiencyScore(workspaceId);
  await detectAnomalies(workspaceId);
}

void intelligenceServicesSmokeTest;

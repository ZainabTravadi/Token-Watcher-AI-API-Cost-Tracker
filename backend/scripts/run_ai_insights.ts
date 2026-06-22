import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { generateInsightsForWorkspace } from "../src/services/aiInsightsService";

async function main() {
  const workspaceId = process.argv[2] || "ws_test";
  try {
    const result = await generateInsightsForWorkspace(workspaceId);
    console.log("AI insights result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("AI insights failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

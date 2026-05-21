#!/usr/bin/env node
import { runTelemetryRetention } from "../services/retentionService";

async function main() {
  const daysEnv = process.env.TELEMETRY_RETENTION_DAYS;
  if (!daysEnv) {
    console.log("TELEMETRY_RETENTION_DAYS not configured; retention disabled.");
    process.exit(0);
  }

  const days = Number(daysEnv);
  if (!Number.isFinite(days) || days < 0) {
    console.error("Invalid TELEMETRY_RETENTION_DAYS value.");
    process.exit(2);
  }

  const batchSize = Number(process.env.TELEMETRY_RETENTION_BATCH ?? "1000");
  const dryRun = process.env.TELEMETRY_RETENTION_APPLY !== "true";

  console.log(`Retention: ${days} days; batchSize=${batchSize}; dryRun=${dryRun}`);
  const result = await runTelemetryRetention({ days, batchSize, dryRun });
  console.log(`Retention result: deleted=${result.deleted} (dryRun=${result.dryRun})`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});

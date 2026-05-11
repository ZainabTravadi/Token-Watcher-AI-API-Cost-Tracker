import { closeDatabase } from "../db/database";
import { seedTelemetryDataset } from "../services/simulatorService";

async function main(): Promise<void> {
  const inserted = seedTelemetryDataset(true);
  process.stdout.write(`Seeded ${inserted} telemetry rows\n`);
  closeDatabase();
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
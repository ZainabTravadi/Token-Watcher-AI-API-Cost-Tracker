import { closeDatabase, initializeDatabase } from "../db/database";
import { seedTelemetryDataset } from "../services/simulatorService";

async function main(): Promise<void> {
  await initializeDatabase();
  const inserted = await seedTelemetryDataset(true);
  process.stdout.write(`Seeded ${inserted} telemetry rows\n`);
  await closeDatabase();
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

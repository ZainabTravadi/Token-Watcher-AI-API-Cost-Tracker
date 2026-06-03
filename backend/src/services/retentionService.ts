import { getDatabase } from "../db/database";

/**
 * Delete telemetry older than the provided cutoff (days) in batches.
 * By default this function performs actions; callers should use dryRun mode to inspect first.
 */
export async function runTelemetryRetention(options: { days: number; batchSize?: number; dryRun?: boolean } ) {
  const { days, batchSize = 1000, dryRun = true } = options;
  if (!Number.isFinite(days) || days < 0) {
    throw new Error("Invalid retention days");
  }

  const db = getDatabase();
  const cutoff = Date.now() - Math.trunc(days) * 24 * 60 * 60 * 1000;

  let totalDeleted = 0;
  while (true) {
    const ids = await db.prepare("SELECT id FROM requests WHERE timestamp < ? ORDER BY timestamp ASC LIMIT ?;").all<{ id: number }>(cutoff, batchSize);
    if (!ids || ids.length === 0) break;

    if (dryRun) {
      totalDeleted += ids.length;
      // In dry run, don't actually delete; just count and exit after reporting sample
      break;
    }

    const result = await db.query("DELETE FROM requests WHERE id = ANY($1::bigint[])", [ids.map((r) => r.id)]);
    totalDeleted += result.rowCount ?? 0;

    // Yield to the event loop to avoid long blocking
    await new Promise((res) => setTimeout(res, 50));
    if (ids.length < batchSize) break;
  }

  return { deleted: totalDeleted, dryRun };
}

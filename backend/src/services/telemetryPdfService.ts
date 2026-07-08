import { generatePdfFromLines } from "./pdfGeneratorService";

interface ExportRow {
  timestamp: number;
  workspace_id: string;
  provider: string;
  model: string;
  endpoint: string;
  status: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function generateTelemetryPdf(rows: ExportRow[]): Buffer {
  const totalCost = rows.reduce((sum, row) => sum + row.cost_usd, 0);
  const totalRequests = rows.length;
  const totalTokens = rows.reduce((sum, row) => sum + row.total_tokens, 0);
  const avgLatency = Math.round(rows.reduce((sum, row) => sum + row.latency_ms, 0) / rows.length);

  const lines = [
    "TokenWatcher - Telemetry Export",
    new Date().toISOString(),
    "",
    "Summary",
    `Total Records: ${totalRequests}`,
    `Total Cost: ${formatCurrency(totalCost)}`,
    `Total Tokens: ${totalTokens.toLocaleString()}`,
    `Average Latency: ${avgLatency} ms`,
    "",
    "Records",
    "---",
  ];

  // Add rows, limiting to a reasonable number per page
  for (const row of rows.slice(0, 100)) {
    lines.push(
      `${formatDateTime(row.timestamp)} | ${row.provider} | ${row.model} | ${row.endpoint} | ${row.status} | ${formatCurrency(row.cost_usd)}`
    );
  }

  if (rows.length > 100) {
    lines.push(`... and ${rows.length - 100} more records`);
  }

  return generatePdfFromLines(lines);
}






import { Download } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtUSD } from "@/lib/data";
import { authFetch } from "@/lib/api";
import type { DateRangeValue, OverviewFilters } from "@/hooks/useOverviewFilters";

export interface ExportRow {
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

function downloadFileBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadFile(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  downloadFileBlob(filename, blob);
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const ExportButton = memo(function ExportButton({ 
  rows, 
  disabled,
  workspaceId,
  dateRange,
  filters 
}: { 
  rows: ExportRow[]
  disabled?: boolean
  workspaceId?: string
  dateRange?: DateRangeValue
  filters?: OverviewFilters
}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const exportCsv = () => {
    const headers = ["timestamp", "workspace_id", "provider", "model", "endpoint", "status", "requests", "input_tokens", "output_tokens", "total_tokens", "cost_usd", "latency_ms"];
    const body = rows.map((row) =>
      headers.map((header) => csvEscape(header === "timestamp" ? new Date(row.timestamp).toISOString() : row[header as keyof ExportRow])).join(","),
    );
    downloadFile(`overview-${timestamp}.csv`, "text/csv;charset=utf-8", [headers.join(","), ...body].join("\n"));
  };

  const exportJson = () => {
    downloadFile(`overview-${timestamp}.json`, "application/json;charset=utf-8", JSON.stringify(rows, null, 2));
  };

  const exportPdf = async () => {
    try {
      // Build query parameters from filters
      const params = new URLSearchParams();
      if (workspaceId) params.append("workspaceId", workspaceId);
      if (dateRange) {
        params.append("from", dateRange.from);
        params.append("to", dateRange.to);
      }
      if (filters) {
        filters.provider.forEach(p => params.append("provider", p));
        filters.model.forEach(m => params.append("model", m));
        filters.endpoint.forEach(e => params.append("endpoint", e));
        filters.status.forEach(s => params.append("status", s));
      }

      const response = await authFetch(`/api/telemetry/export-pdf?${params}`, {
        method: "GET"
      });

      if (!response.ok) {
        throw new Error(`PDF export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      downloadFileBlob(`overview-${timestamp}.pdf`, blob);
    } catch (error) {
      console.error("PDF export error:", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || rows.length === 0} className="font-mono">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-2">
        <div className="grid gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={exportCsv} className="justify-start">CSV</Button>
          <Button type="button" variant="ghost" size="sm" onClick={exportJson} className="justify-start">JSON</Button>
          <Button type="button" variant="ghost" size="sm" onClick={exportPdf} className="justify-start">PDF</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});

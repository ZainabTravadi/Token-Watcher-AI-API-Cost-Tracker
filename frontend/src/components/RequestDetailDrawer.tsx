import Drawer from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import type { TelemetryRow } from "@/lib/api";
import { fmtCompactNum, fmtLatency, fmtNum, fmtUSD } from "@/lib/data";

interface RequestDetailDrawerProps {
  request: TelemetryRow | null;
  open: boolean;
  onClose: () => void;
}

type ParsedMetadata = {
  event?: unknown;
  projectId?: unknown;
  identity?: unknown;
  properties?: unknown;
  raw?: unknown;
};

function getStatusLabel(error: string | null): string {
  if (!error) return "200";
  if (error.startsWith("HTTP_429")) return "429";
  if (error.startsWith("HTTP_500")) return "500";
  return "ERR";
}

function parseMetadata(value: string | null | undefined): ParsedMetadata | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : { raw: parsed };
  } catch {
    return { raw: value };
  }
}

function stringifyJson(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function escapeHtml(unsafe: string) {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(jsonStr: string) {
  // basic JSON highlighter: keys, strings, numbers, booleans, null
  const escaped = escapeHtml(jsonStr);
  return escaped
  // keys
  .replace(/("(.*?)")(?=\s*:)/g, '<span class="text-foreground/90">$1</span>')
  // strings
  .replace(/(:\s*)(".*?")/g, (m, p1, p2) => `${p1}<span class="text-foreground/80">${p2}</span>`)
  // numbers (supports simple scientific notation)
  .replace(/(:\s*)(-?\d+\.?\d*(e[-+]?\d+)?)/gi, (m, p1, p2) => `${p1}<span class="text-foreground/70">${p2}</span>`)
  // booleans & null
  .replace(/(:\s*)(true|false|null)/gi, (m, p1, p2) => `${p1}<span class="text-foreground/70">${p2}</span>`);
}

function metadataValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return stringifyJson(value);
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-mono mb-2">{label}</div>
      <div className="font-mono text-sm break-words">{value}</div>
    </div>
  );
}

export function RequestDetailDrawer({ request, open, onClose }: RequestDetailDrawerProps) {
  const metadata = parseMetadata(request?.metadata);
  const eventName = metadataValue(metadata?.event);
  const projectId = metadataValue(metadata?.projectId);
  const identity = metadataValue(metadata?.identity);
  const metadataJson = metadata ? stringifyJson(metadata) : "{}";
  const rawJson = request ? stringifyJson(request) : "{}";

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // ignore
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={request ? `${request.route} | request #${request.id}` : undefined}>
      {request && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailMetric label="Timestamp" value={new Date(request.timestamp).toLocaleString()} />
            <DetailMetric label="Provider" value={request.provider} />
            <DetailMetric label="Latency" value={fmtLatency(request.latency_ms)} />
            <DetailMetric label="Cost" value={fmtUSD(request.cost_usd)} />
          </div>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="label-mono mb-2">Request</h3>
              <div className="border-t border-hairline pt-3 space-y-2 text-sm font-mono">
                <div>Route: {request.route}</div>
                <div>Model: {request.model}</div>
                <div>Provider: {request.provider}</div>
                <div>Status: {getStatusLabel(request.error)}</div>
                {eventName && <div>Event: {eventName}</div>}
                {projectId && <div>Project: {projectId}</div>}
              </div>
            </div>
            <div>
              <h3 className="label-mono mb-2">Tokens</h3>
              <div className="border-t border-hairline pt-3 text-sm font-mono">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-muted-foreground">Input</div>
                    <div>{fmtNum(request.input_tokens)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Output</div>
                    <div>{fmtNum(request.output_tokens)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div>{fmtCompactNum(request.total_tokens)}</div>
                  </div>
                </div>
                <div className="mt-3 h-3 bg-secondary relative overflow-hidden rounded">
                  {(() => {
                    const total = Math.max(1, request.total_tokens);
                    const inPct = Math.round((request.input_tokens / total) * 100);
                    const outPct = Math.round((request.output_tokens / total) * 100);
                    return (
                      <div className="flex h-full">
                        <div className="bg-foreground/70" style={{ width: `${inPct}%` }} />
                        <div className="bg-foreground/40" style={{ width: `${outPct}%` }} />
                        <div style={{ width: `${100 - inPct - outPct}%` }} />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </section>

          {identity && (
            <section>
              <h3 className="label-mono mb-2">Identity</h3>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs text-muted-foreground">raw</div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(identity ?? "")}>Copy</Button>
              </div>
              <pre className="border-t border-hairline bg-secondary/20 p-3 pt-3 overflow-auto text-xs font-mono leading-6 whitespace-pre-wrap">
                {identity}
              </pre>
            </section>
          )}

          <section>
            <h3 className="label-mono mb-2">Error</h3>
            <div className="border-t border-hairline pt-3 text-sm">
              {request.error ? <div className="font-mono text-negative break-words">{request.error}</div> : <div className="text-muted-foreground">No error recorded</div>}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="label-mono mb-2">Metadata JSON</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(metadataJson)}>Copy metadata</Button>
              </div>
            </div>
            <div className="border-t border-hairline bg-secondary/20 p-3 pt-3 overflow-auto text-xs font-mono leading-6 max-h-72">
              <pre className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: highlightJson(metadataJson) }} />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="label-mono mb-2">Raw row</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(rawJson)}>Copy raw</Button>
              </div>
            </div>
            <div className="border-t border-hairline bg-secondary/20 p-3 pt-3 overflow-auto text-xs font-mono leading-6 max-h-72">
              <pre className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: highlightJson(rawJson) }} />
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

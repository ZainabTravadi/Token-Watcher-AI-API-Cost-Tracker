import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceInfo } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

type Framework = "node" | "next" | "express" | "python";

const FRAMEWORKS: Array<{ id: Framework; label: string }> = [
  { id: "node", label: "Node.js" },
  { id: "next", label: "Next.js" },
  { id: "express", label: "Express" },
  { id: "python", label: "Python" },
];

function maskApiKey(value?: string): string {
  if (!value) return "tw_live_your_api_key";
  return value.length > 18 ? `${value.slice(0, 14)}...${value.slice(-4)}` : value;
}

function snippetFor(framework: Framework, workspace: WorkspaceInfo): string {
  const apiKey = workspace.apiKey?.value ?? "process.env.TOKENWATCH_API_KEY";

  if (framework === "next") {
    return `// app/api/chat/route.ts
  import { TokenWatch } from "@zn_/tokenwatch";

  TokenWatch.init({
  apiUrl: "${API_BASE_URL}",
  workspaceId: "${workspace.id}",
  apiKey: process.env.TOKENWATCH_API_KEY!
});

export async function POST(request: Request) {
  const started = Date.now();

  try {
    const response = await callYourModel(await request.json());

    await TokenWatch.track("llm.request.completed", {
      route: "/api/chat",
      provider: response.provider,
      model: response.model,
      input_tokens: response.usage.input,
      output_tokens: response.usage.output,
      cost_usd: response.costUsd,
      latency_ms: Date.now() - started
    });

    return Response.json(response.data);
  } finally {
    await TokenWatch.flush();
  }
}`;
  }

  if (framework === "express") {
    return `import express from "express";
  import { TokenWatch } from "@zn_/tokenwatch";

  TokenWatch.init({
  apiUrl: "${API_BASE_URL}",
  workspaceId: "${workspace.id}",
  apiKey: process.env.TOKENWATCH_API_KEY ?? "${apiKey}"
});

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const started = Date.now();
  const result = await callYourModel(req.body);

  await TokenWatch.track("llm.request.completed", {
    route: "/api/chat",
    provider: result.provider,
    model: result.model,
    input_tokens: result.usage.input,
    output_tokens: result.usage.output,
    cost_usd: result.costUsd,
    latency_ms: Date.now() - started
  });

  res.json(result.data);
});`;
  }

  if (framework === "python") {
    return `# Python SDK is not published yet.
# For now, post telemetry directly to the ingest API.

import requests

requests.post(
  "${API_BASE_URL}/api/ingest",
  headers={"X-API-Key": "tw_live_your_api_key"},
  json={
    "route": "/api/chat",
    "provider": "Your provider",
    "model": "your-model",
    "input_tokens": 120,
    "output_tokens": 80,
    "cost_usd": 0.0042,
    "latency_ms": 640,
  },
)`;
  }

  return `import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
  apiUrl: "${API_BASE_URL}",
  workspaceId: "${workspace.id}",
  apiKey: process.env.TOKENWATCH_API_KEY ?? "${apiKey}"
});

await TokenWatch.track("llm.request.completed", {
  route: "/api/chat",
  provider: "YourProvider",
  model: "your-model",
  input_tokens: 120,
  output_tokens: 80,
  cost_usd: 0.0042,
  latency_ms: 640,
  properties: {
    requestId: "req_123"
  }
});

await TokenWatch.flush();`;
}

const quickStartSteps = [
  "Install the package: npm install @zn_/tokenwatch",
  "Initialize with your Workspace ID from the sidebar and API key from Settings → API Keys",
  "Send one track() event and call flush() before exit",
  "Verify in Overview, Recent Activity, Endpoints, and Models"
];

const troubleshootingItems = [
  {
    title: "No data appears",
    items: ["Check the backend is running", "Confirm the apiUrl", "Confirm the Workspace ID", "Confirm the API key", "Call flush()", "Make sure you are in the correct workspace"],
  },
  {
    title: "Events visible in API but not dashboard",
    items: ["Dashboard aggregates by workspace", "Verify workspace selection in the sidebar", "Refresh the page", "Check the Recent Activity table"],
  },
  {
    title: "Realtime stream disconnected",
    items: ["SSE reconnects automatically", "Localhost restarts can temporarily disconnect the stream", "Refresh the browser if needed"],
  },
];

export function SdkOnboarding({ workspace, compact = false }: { workspace: WorkspaceInfo; compact?: boolean }) {
  const [framework, setFramework] = useState<Framework>("node");
  const [copied, setCopied] = useState<string | null>(null);
  const snippet = useMemo(() => snippetFor(framework, workspace), [framework, workspace]);
  const install = "npm install @zn_/tokenwatch";

  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <section className={`border border-hairline bg-secondary/20 ${compact ? "p-4" : "p-5"} space-y-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="label-mono mb-2">Connect your app</div>
          <h2 className="font-serif text-2xl leading-tight">Send one telemetry row and the dashboard will populate live.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A default workspace is created when you sign up. Copy the Workspace ID from the sidebar, open Settings → API Keys to view or rotate your API key, then install the SDK and initialize it with the hosted or local API URL.
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground sm:text-right">
          <div>{workspace.id}</div>
          <div>{maskApiKey(workspace.apiKey?.value)}</div>
        </div>
      </div>

      <div className="rounded border border-hairline bg-background p-4 text-sm leading-6 text-muted-foreground">
        <p className="font-medium text-foreground">Where credentials come from</p>
        <p className="mt-1">Workspace ID lives in the sidebar. API keys live under Settings → API Keys. Use <span className="font-mono">http://localhost:3001</span> for local development or your hosted backend URL in production.</p>
      </div>

      <div className="rounded border border-hairline bg-background p-4 text-sm leading-6">
        <p className="font-medium">5-Minute Quick Start</p>
        <ol className="mt-2 space-y-1 list-decimal pl-5 text-muted-foreground">
          {quickStartSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6 text-foreground">
        <p className="font-medium">Why flush() matters</p>
        <p className="mt-1">TokenWatch batches events before delivery. Node scripts can exit before the queued event leaves the process unless you call <span className="font-mono">flush()</span>.</p>
        <ul className="mt-2 space-y-1 list-disc pl-5 text-muted-foreground">
          <li>SDK batches events before sending them.</li>
          <li>Node scripts can exit before delivery completes.</li>
          <li><span className="font-mono">flush()</span> guarantees queued telemetry is sent before shutdown.</li>
        </ul>
      </div>

      <div className="rounded border border-hairline bg-background p-4 text-sm leading-6">
        <p className="font-medium">Troubleshooting</p>
        <div className="mt-3 space-y-4 text-muted-foreground">
          {troubleshootingItems.map((section) => (
            <div key={section.title}>
              <p className="font-medium text-foreground">{section.title}</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <pre className="flex-1 overflow-x-auto border border-hairline bg-background p-3 text-xs font-mono">{install}</pre>
        <Button type="button" variant="outline" onClick={() => copy("install", install)} className="shrink-0">
          {copied === "install" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          Copy
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FRAMEWORKS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFramework(item.id)}
            className={`border px-3 py-1.5 text-xs font-mono ${framework === item.id ? "border-foreground bg-background text-foreground" : "border-hairline text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <pre className="max-h-[420px] overflow-auto border border-hairline bg-background p-4 pr-24 text-xs leading-5 font-mono whitespace-pre-wrap">
          {snippet}
        </pre>
        <Button type="button" variant="outline" size="sm" onClick={() => copy("snippet", snippet)} className="absolute right-3 top-3 bg-background">
          {copied === "snippet" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          Copy
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">Verify in dashboard: check Overview, Recent Activity, Endpoints, and Models after the first event lands.</p>
    </section>
  );
}

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
  import { TokenWatch } from "@zainabtravadi/tokenwatch";

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
  import { TokenWatch } from "@zainabtravadi/tokenwatch";

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

  return `import { TokenWatch } from "@zainabtravadi/tokenwatch";

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

export function SdkOnboarding({ workspace, compact = false }: { workspace: WorkspaceInfo; compact?: boolean }) {
  const [framework, setFramework] = useState<Framework>("node");
  const [copied, setCopied] = useState<string | null>(null);
  const snippet = useMemo(() => snippetFor(framework, workspace), [framework, workspace]);
  const install = "npm install tokenwatch";

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
            Install the SDK, initialize it with this workspace, then track your model calls with route, provider, model, tokens, cost, and latency.
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground sm:text-right">
          <div>{workspace.id}</div>
          <div>{maskApiKey(workspace.apiKey?.value)}</div>
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
    </section>
  );
}

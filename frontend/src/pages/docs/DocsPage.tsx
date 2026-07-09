import AppLayout from "@/components/AppLayout";

type DocSlug = "getting-started" | "sdk-reference" | "webhooks";

interface DocsPageProps {
  slug: DocSlug;
}

const docs: Record<DocSlug, { title: string; sections: Array<{ heading: string; body: string[]; code?: string }> }> = {
  "getting-started": {
    title: "Getting started",
    sections: [
      {
        heading: "Frontend Deployment",
        body: [
          "The frontend should point to the backend API URL, which then talks to SQLite.",
          "Local example: use http://localhost:3001 for the backend.",
          "Production example: use your deployed backend URL.",
          "SSE endpoint requirement: /api/telemetry/stream must remain reachable.",
          "Reverse proxy consideration: avoid buffering SSE responses and preserve long-lived connections."
        ]
      },
      {
        heading: "5-Minute Quick Start",
        body: [
          "Install the package, initialize the SDK, send one event, flush before exit, then verify in the dashboard.",
          "Look in Overview, Recent Activity, Endpoints, and Models after the first event lands."
        ],
        code: "npm install @zn_/tokenwatch\n\nimport { TokenWatch } from \"@zn_/tokenwatch\";\n\nTokenWatch.init({\n  apiUrl: \"http://localhost:3001\",\n  workspaceId: \"ws_xxxxxxxx\",\n  apiKey: \"tw_live_xxxxxxxx\"\n});\n\nawait TokenWatch.track(\n  \"llm.request.completed\",\n  {\n    route: \"/api/chat\",\n    provider: \"openai\",\n    model: \"gpt-4o\",\n    input_tokens: 120,\n    output_tokens: 80,\n    cost_usd: 0.0042,\n    latency_ms: 640\n  }\n);\n\nawait TokenWatch.flush();"
      },
      {
        heading: "Expected Result",
        body: [
          "Overview page updates.",
          "Recent Activity shows a new row.",
          "Endpoint appears in analytics.",
          "Stream status shows connected."
        ],
      },
      {
        heading: "Need credentials?",
        body: [
          "Workspace ID: Dashboard → Sidebar → Copy Workspace ID.",
          "API Key: Dashboard → Settings → API Keys.",
          "apiUrl: Local [http://localhost:3001](http://localhost:3001), hosted = your deployed backend URL."
        ],
      },
      {
        heading: "Production Verification",
        body: [
          "After deployment verify: Login works, Workspace visible, API key creation works, SDK can ingest events, Dashboard receives data, SSE stream connected."
        ]
      },
      {
        heading: "Common Production Problems",
        body: [
          "SSE disconnects: the stream reconnects automatically, but proxy timeouts or localhost restarts can interrupt it temporarily.",
          "Wrong backend URL: the frontend will appear healthy but telemetry will never reach the backend.",
          "Invalid API keys: ingestion requests will fail authorization and events will not be stored.",
          "Empty dashboard: check the workspace selection and confirm data is being written to the expected workspace.",
          "CORS issues: ensure the frontend origin is allowed by the backend deployment.",
          "Backend unavailable: verify the backend service is running and reachable from the frontend."
        ]
      },
      {
        heading: "Why flush() matters",
        body: [
          "Telemetry is batched.",
          "Short-lived scripts and serverless functions may exit before queued events are delivered.",
          "Always call `await TokenWatch.flush();` before shutdown."
        ],
        code: "await TokenWatch.flush();"
      },
      {
        heading: "Troubleshooting",
        body: [
          "No data appearing?",
          "1. Is backend running?",
          "2. Is apiUrl correct?",
          "3. Is workspaceId correct?",
          "4. Is API key valid?",
          "5. Did you call flush()?",
          "6. Are filters cleared?"
        ]
      }
    ]
  },
  "sdk-reference": {
    title: "SDK reference",
    sections: [
      {
        heading: "Initialization",
        body: [
          "`workspaceId` comes from the sidebar in the dashboard and `apiKey` comes from Settings → API Keys. Use `http://localhost:3001` locally or your hosted backend URL in production.",
          "Only `apiUrl`, `workspaceId`, and `apiKey` are required. Optional operational controls (`batchSize`, `flushInterval`, `maxQueueSize`, `retryAttempts`) have safe defaults."
        ],
        code: "TokenWatch.init({\n  apiUrl: \"https://tokenwatch.example.com\",\n  workspaceId: \"ws_xxxxxxxx\",\n  apiKey: \"tw_live_xxxxx\",\n  maxQueueSize: 1000,\n  batchSize: 50,\n  flushInterval: 25,\n  retryAttempts: 3,\n  debug: false\n});"
      },
      {
        heading: "Delivery behavior",
        body: [
          "Events are queued in a bounded in-memory queue and flushed in groups. 4xx responses are treated as permanent failures; 5xx and network errors are retried with jittered backoff. `flush()` waits for outstanding deliveries.",
          "Use `stats()` for operational visibility: queue size, in‑flight requests, rejected counts, retries, and last error."
        ],
        code: "await TokenWatch.track(\"checkout.llm_call\", {\n  route: \"/checkout\",\n  provider: \"YourProvider\",\n  model: \"your-model\",\n  input_tokens: 240,\n  output_tokens: 120,\n  cost_usd: 0.006,\n  latency_ms: 820\n});\nawait TokenWatch.flush();\n\nconsole.log(TokenWatch.stats());"
      }
    ]
  },
  webhooks: {
    title: "Webhooks",
    sections: [
      {
        heading: "Current status",
        body: [
          "Workspaces store an optional webhook URL. Delivery workers are not enabled in this release — alerts should be polled from the API or handled from the dashboard until dispatch is implemented."
        ]
      },
      {
        heading: "Planned payload shape",
        body: [
          "Planned webhook payloads will be workspace-scoped and signed. Receivers should verify signatures, handle idempotency, and return 2xx only after durable processing."
        ],
        code: "{\n  \"id\": \"evt_123\",\n  \"workspaceId\": \"ws_xxxxxxxx\",\n  \"type\": \"budget.threshold_exceeded\",\n  \"createdAt\": 1760000000000,\n  \"data\": {\n    \"spendToday\": 52.4,\n    \"threshold\": 50\n  }\n}"
      },
      {
        heading: "Local testing",
        body: [
          "During development, a local `http://localhost` webhook URL can be saved in Settings for testing. Use HTTPS in production once delivery is available."
        ]
      }
    ]
  }
};

export default function DocsPage({ slug }: DocsPageProps) {
  const doc = docs[slug];

  return (
    <AppLayout title={doc.title}>
      <div className="grid max-w-5xl gap-10 lg:grid-cols-[180px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="label-mono mb-3">Document map</div>
          <nav className="border-t border-hairline">
            {doc.sections.map((section, index) => (
              <a
                key={section.heading}
                href={`#${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="block border-b border-hairline/60 py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:bg-secondary/70"
              >
                {String(index + 1).padStart(2, "0")} / {section.heading}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-10">
          {doc.sections.map((section, index) => (
            <section key={section.heading} id={section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="scroll-mt-28 border-t border-hairline pt-5">
              <div className="label-mono mb-2">{String(index + 1).padStart(2, "0")} / {slug}</div>
              <h2 className="font-serif text-2xl">{section.heading}</h2>
              <div className="mt-4 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.code && (
                <div className="mt-5 border border-hairline bg-surface">
                  <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
                    <span className="label-mono">example</span>
                    <span className="font-mono text-[11px] text-muted-foreground">copy-ready</span>
                  </div>
                  <pre className="overflow-x-auto p-4 font-mono text-xs leading-6">
                    <code>{section.code}</code>
                  </pre>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

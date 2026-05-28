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
        heading: "Run TokenWatch locally",
        body: [
          "Start the backend, then the frontend. SQLite initializes automatically and the dashboard reads live workspace data.",
          "Create an account, open Settings, copy the workspace ID, and rotate the API key if needed."
        ],
        code: "cd backend\nnpm install\nnpm run dev\n\ncd ../frontend\nnpm install\nnpm run dev"
      },
      {
        heading: "Send your first event",
        body: [
          "The SDK posts to the ingest endpoint (default `/ingest`) and includes the workspace API key in `X-API-Key`.",
          "The backend verifies the key and attaches the event to the authenticated workspace; clients cannot claim another workspace."
        ],
        code: "import * as TokenWatch from 'tokenwatch';\n\nTokenWatch.init({ apiUrl: 'http://localhost:3001', workspaceId: 'ws_xxxxxxxx', apiKey: process.env.TOKENWATCH_API_KEY });\n\nawait TokenWatch.track('llm.request.completed', {\n  route: '/api/chat',\n  provider: 'YourProvider',\n  model: 'your-model',\n  input_tokens: 120,\n  output_tokens: 80,\n  cost_usd: 0.0042,\n  latency_ms: 640\n});\n\nawait TokenWatch.flush();"
      }
    ]
  },
  "sdk-reference": {
    title: "SDK reference",
    sections: [
      {
        heading: "Initialization",
        body: [
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
      <div className="max-w-3xl space-y-10">
        {doc.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.code && (
              <pre className="overflow-x-auto border border-gray-200 bg-gray-50 p-4 text-xs leading-5">
                <code>{section.code}</code>
              </pre>
            )}
          </section>
        ))}
      </div>
    </AppLayout>
  );
}

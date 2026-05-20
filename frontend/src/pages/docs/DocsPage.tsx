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
          "Create an account, open Settings, copy the workspace ID, and rotate the API key if you need a fresh secret value."
        ],
        code: "cd backend\nnpm install\nnpm run dev\n\ncd ../frontend\nnpm install\nnpm run dev"
      },
      {
        heading: "Send your first event",
        body: [
          "The SDK sends to /api/ingest with X-API-Key. The backend derives workspace ownership from the key, so payloads cannot choose another workspace."
        ],
        code: "import { TokenWatch } from \"tokenwatch\";\n\nTokenWatch.init({\n  apiUrl: \"http://localhost:3001\",\n  workspaceId: \"ws_xxxxxxxx\",\n  apiKey: \"tw_live_xxxxx\"\n});\n\nawait TokenWatch.track(\"request.completed\", {\n  properties: { route: \"/api/chat\" }\n});\nawait TokenWatch.flush();"
      },
      {
        heading: "Use the simulator",
        body: [
          "Simulation is useful for local dashboards and demos. Profiles change event cadence while preserving the same ingestion path as real SDK traffic."
        ],
        code: "const simulation = TokenWatch.startSimulation({ profile: \"medium\" });\n\n// later\nsimulation.stop();\nawait TokenWatch.flush();"
      }
    ]
  },
  "sdk-reference": {
    title: "SDK reference",
    sections: [
      {
        heading: "Initialization",
        body: [
          "Only apiUrl, workspaceId, and apiKey are required. Operational controls are optional and keep safe defaults when omitted."
        ],
        code: "TokenWatch.init({\n  apiUrl: \"https://tokenwatch.example.com\",\n  workspaceId: \"ws_xxxxxxxx\",\n  apiKey: \"tw_live_xxxxx\",\n  maxQueueSize: 1000,\n  batchSize: 50,\n  flushInterval: 25,\n  retryAttempts: 3,\n  debug: false\n});"
      },
      {
        heading: "Delivery behavior",
        body: [
          "Events batch for a short interval or flush when batchSize is reached. 4xx responses are treated as permanent, 5xx and network failures retry with jittered backoff, and flush() resolves when queued delivery completes.",
          "stats() is intended for development and operational visibility. Debug logging is off by default."
        ],
        code: "await TokenWatch.track(\"checkout.llm_call\");\nawait TokenWatch.simulate({ profile: \"high\" });\nawait TokenWatch.flush();\n\nconsole.log(TokenWatch.stats());"
      }
    ]
  },
  webhooks: {
    title: "Webhooks",
    sections: [
      {
        heading: "Current status",
        body: [
          "Workspaces store a webhook URL today. Delivery workers are intentionally not enabled yet, so production alerts should still be handled from the dashboard/API until webhook dispatch is added."
        ]
      },
      {
        heading: "Planned payload shape",
        body: [
          "Payloads will be workspace-scoped and signed before delivery. Receivers should verify the signature, process idempotently, and return 2xx only after durable handling."
        ],
        code: "{\n  \"id\": \"evt_123\",\n  \"workspaceId\": \"ws_xxxxxxxx\",\n  \"type\": \"budget.threshold_exceeded\",\n  \"createdAt\": 1760000000000,\n  \"data\": {\n    \"spendToday\": 52.4,\n    \"threshold\": 50\n  }\n}"
      },
      {
        heading: "Local testing",
        body: [
          "Use Settings to save an http://localhost URL during development. Keep HTTPS for production endpoints once delivery is implemented."
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

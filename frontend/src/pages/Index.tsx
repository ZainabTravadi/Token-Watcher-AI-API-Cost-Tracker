import { Link } from "react-router-dom";

const specRows = [
  ["transport", "sdk telemetry, direct application emit"],
  ["storage", "workspace-scoped request ledger"],
  ["interface", "overview, endpoints, models, request log"],
  ["operators", "filters, export, live stream, audit drawer"],
];

const consoleRows = [
  ["09:41:12", "/api/chat", "gpt-4o-mini", "$0.0042", "200"],
  ["09:41:09", "/jobs/summarize", "claude-3-5", "$0.0181", "200"],
  ["09:40:58", "/api/search", "text-embedding-3", "$0.0007", "200"],
  ["09:40:44", "/agents/reconcile", "gemini-1.5-pro", "$0.0314", "429"],
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="hairline">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-6 sm:px-8">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="font-serif text-xl leading-none">TokenWatcher</span>
            <span className="hidden truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
              operating ledger for AI infrastructure
            </span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#system" className="hidden link-underline sm:inline">System</a>
            <a href="#install" className="hidden link-underline sm:inline">Install</a>
            <Link to="/login" className="link-underline">Sign in</Link>
            <Link to="/app" className="btn-rect h-8 px-3 text-xs">Open console</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1120px] grid-cols-12 gap-x-8 gap-y-10 px-6 pb-14 pt-16 sm:px-8 lg:pt-20">
          <div className="col-span-12 lg:col-span-8">
            <div className="label-mono mb-5">Phase 2 / Console specification / 2026</div>
            <h1 className="max-w-4xl font-serif text-4xl leading-[0.98] tracking-tight sm:text-5xl lg:text-[64px]">
              A quiet operating system for AI spend.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-foreground/80 sm:text-lg">
              TokenWatcher records requests, tokens, latency, errors, and cost as operational facts. It is built for engineers who need an exact ledger, not a decorative dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/app" className="btn-rect h-10 px-5 text-sm">Open console</Link>
              <a href="#install" className="btn-rect-ghost h-10 px-5 text-sm">Read install notes</a>
              <span className="w-full font-mono text-xs text-muted-foreground sm:w-auto">sdk-first / realtime / exportable</span>
            </div>
          </div>

          <aside className="col-span-12 border-t border-hairline pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="label-mono mb-4">System index</div>
            <dl className="space-y-4">
              {specRows.map(([term, detail]) => (
                <div key={term} className="grid grid-cols-[96px_1fr] gap-3 border-b border-hairline/60 pb-3 text-sm">
                  <dt className="font-mono text-xs text-muted-foreground">{term}</dt>
                  <dd className="leading-6">{detail}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </section>

        <section id="system" className="hairline-t hairline">
          <div className="mx-auto grid max-w-[1120px] grid-cols-12 gap-8 px-6 py-14 sm:px-8">
            <div className="col-span-12 md:col-span-3">
              <div className="label-mono">01 / Console</div>
              <h2 className="mt-2 font-serif text-2xl">Request ledger</h2>
            </div>
            <div className="col-span-12 md:col-span-9">
              <div className="border border-hairline bg-surface">
                <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                  <span className="label-mono">live stream preview</span>
                  <span className="font-mono text-xs text-muted-foreground">scrubbed / latest 4</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-hairline">
                        {["time", "endpoint", "model", "cost", "status"].map((head) => (
                          <th key={head} className="label-mono px-4 py-2 text-left font-normal last:text-right">{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {consoleRows.map((row) => (
                        <tr key={`${row[0]}-${row[1]}`} className="border-b border-hairline/60 last:border-b-0">
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row[0]}</td>
                          <td className="px-4 py-2 font-mono">{row[1]}</td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row[2]}</td>
                          <td className="px-4 py-2 text-right font-mono">{row[3]}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs">{row[4]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="hairline">
          <div className="mx-auto grid max-w-[1120px] grid-cols-12 gap-x-8 gap-y-10 px-6 py-14 sm:px-8">
            <div className="col-span-12 md:col-span-3">
              <div className="label-mono">02 / Principles</div>
              <h2 className="mt-2 font-serif text-2xl">Information first</h2>
            </div>
            <div className="col-span-12 grid gap-8 md:col-span-9 md:grid-cols-3">
              {[
                ["No proxy required", "Wrap existing provider clients and keep application traffic under your control."],
                ["Cost as a ledger", "Group spend by workspace, route, provider, model, request, and time range."],
                ["Console ergonomics", "Use filters, dense tables, sticky controls, exports, and detail drawers for repeated operational work."],
              ].map(([title, body]) => (
                <section key={title} className="border-t border-hairline pt-4">
                  <h3 className="font-serif text-xl">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-foreground/75">{body}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section id="install" className="hairline">
          <div className="mx-auto grid max-w-[1120px] grid-cols-12 gap-8 px-6 py-14 sm:px-8">
            <div className="col-span-12 md:col-span-3">
              <div className="label-mono">03 / Install</div>
              <h2 className="mt-2 font-serif text-2xl">SDK notes</h2>
            </div>
            <div className="col-span-12 md:col-span-9">
              <pre className="overflow-x-auto border border-hairline bg-surface p-5 font-mono text-[13px] leading-7 text-foreground">
{`# install
npm install @zn_/tokenwatch

# initialize
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
  apiUrl: "http://localhost:3001",
  apiKey: "tw_sdk_xxxxxxxx"
});

await TokenWatch.track("llm.request.completed", {
  route,
  provider,
  model,
  input_tokens,
  output_tokens,
  cost_usd,
  latency_ms
});`}
              </pre>
            </div>
          </div>
        </section>
      </main>

      <footer className="hairline-t">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <span className="font-serif text-base">TokenWatcher</span>
            <span className="ml-3 text-muted-foreground">professional console for AI infrastructure</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground">MIT / 2026</div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

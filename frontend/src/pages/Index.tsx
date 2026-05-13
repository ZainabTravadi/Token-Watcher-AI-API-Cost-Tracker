import { Link } from "react-router-dom";
import { fmtUSD, fmtNum } from "@/lib/data";
import { PageLoadingState } from "@/components/AsyncState";

const Index = () => {
  // Show landing page with demo/placeholder data
  const top = [
    { route: "/api/chat", requests: 18403, cost_usd: 1230.50, avg_cost_usd: 0.067, avg_latency_ms: 1200 },
    { route: "/api/summarize", requests: 3200, cost_usd: 412.80, avg_cost_usd: 0.129, avg_latency_ms: 2400 },
    { route: "/api/search", requests: 2100, cost_usd: 68.50, avg_cost_usd: 0.033, avg_latency_ms: 800 },
    { route: "/api/autocomplete", requests: 1400, cost_usd: 45.20, avg_cost_usd: 0.032, avg_latency_ms: 400 },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="hairline">
        <div className="max-w-[1100px] mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-xl leading-none">TokenWatch</span>
            <span className="label-mono">a developer log for AI spend</span>
          </div>
          <nav className="flex items-center gap-7 text-sm">
            <a href="#product" className="link-underline">Product</a>
            <a href="#install" className="link-underline">Install</a>
            <a href="#" className="link-underline">Docs</a>
            <a href="#" className="link-underline">GitHub</a>
            <Link to="/app" className="btn-rect h-8 px-3 text-xs">Open Console →</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-8 pt-24 pb-20 grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-8">
          <div className="label-mono mb-6">Issue 04 · May 2026 · v0.4.1</div>
          <h1 className="font-serif text-[64px] leading-[1.02] tracking-tight mb-8">
            Know exactly where your<br />
            <em className="font-serif italic">AI money</em> is going.
          </h1>
          <p className="text-lg max-w-xl text-foreground/80 leading-relaxed mb-10">
            Track every request, every token, every dollar — across all your endpoints.
            A small, local-first observability layer for teams shipping with LLMs.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/app" className="btn-rect">Open Dashboard</Link>
            <a href="#" className="btn-rect-ghost">View Documentation</a>
          </div>
        </div>
        <aside className="col-span-12 md:col-span-4 md:pl-8 md:border-l border-hairline">
          <div className="label-mono mb-3">Filed under</div>
          <ul className="text-sm space-y-1.5">
            <li>— Observability</li>
            <li>— FinOps for AI</li>
            <li>— Developer tools</li>
          </ul>
          <div className="label-mono mt-8 mb-3">Compatible with</div>
          <ul className="text-sm space-y-1.5 font-mono">
            <li>openai · v4+</li>
            <li>@anthropic-ai/sdk</li>
            <li>@google/genai</li>
            <li>vercel/ai</li>
          </ul>
        </aside>
      </section>

      {/* Product points */}
      <section id="product" className="hairline-t hairline">
        <div className="max-w-[1100px] mx-auto px-8 py-16 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-3">
            <div className="label-mono">§ 01</div>
            <h2 className="font-serif text-2xl mt-2">What it does</h2>
          </div>
          <div className="col-span-12 md:col-span-9 grid md:grid-cols-2 gap-x-12 gap-y-10">
            {[
              ["Real-time accounting", "Every call to OpenAI, Anthropic, Google, or your own gateway is logged with token counts and resolved cost the moment it returns."],
              ["No proxy required", "TokenWatch wraps your existing SDK clients. No traffic is rerouted. Your latency is your latency."],
              ["Local-first", "Records persist to a local SQLite file by default. Sync to the console when you want a team view — never before."],
              ["Endpoint resolution", "Costs aren't grouped by API key. They're grouped by your route, your user, your job — whatever you tag."],
            ].map(([h, b]) => (
              <div key={h}>
                <h3 className="font-serif text-lg mb-2">{h}</h3>
                <p className="text-sm text-foreground/75 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <section id="install" className="hairline">
        <div className="max-w-[1100px] mx-auto px-8 py-16 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-3">
            <div className="label-mono">§ 02</div>
            <h2 className="font-serif text-2xl mt-2">Install</h2>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="bg-surface border border-hairline p-5 font-mono text-[13px] leading-7">
              <div className="text-muted-foreground"># 1. install</div>
              <div>npm install tokenwatch</div>
              <div className="text-muted-foreground mt-3"># 2. wrap your client</div>
              <div><span className="text-muted-foreground">import</span> {"{ track }"} <span className="text-muted-foreground">from</span> <span>"tokenwatch"</span></div>
              <div><span className="text-muted-foreground">const</span> openai = track(<span className="text-muted-foreground">new</span> OpenAI(), {"{ endpoint: \"/api/chat\" }"})</div>
              <div className="text-muted-foreground mt-3"># 3. that's it. open the console.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live preview */}
      <section className="hairline">
        <div className="max-w-[1100px] mx-auto px-8 py-16 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-3">
            <div className="label-mono">§ 03</div>
            <h2 className="font-serif text-2xl mt-2">From the console</h2>
            <p className="text-sm text-muted-foreground mt-3">Spend by endpoint, last 24h. Real workspace, scrubbed.</p>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="border border-hairline bg-surface">
              <div className="flex items-center justify-between px-4 h-9 border-b border-hairline">
                <div className="label-mono">acme-prod / endpoints</div>
                <div className="text-xs font-mono text-muted-foreground">24h · USD</div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="label-mono text-left py-2 px-4 font-normal">Endpoint</th>
                    <th className="label-mono text-right py-2 px-4 font-normal">Requests</th>
                    <th className="label-mono text-right py-2 px-4 font-normal">Total cost</th>
                    <th className="label-mono text-right py-2 px-4 font-normal">Avg / req</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((e) => (
                    <tr key={e.route} className="border-b border-hairline/60">
                      <td className="py-2.5 px-4 font-mono text-sm">{e.route}</td>
                      <td className="py-2.5 px-4 text-sm num text-right">{fmtNum(e.requests)}</td>
                      <td className="py-2.5 px-4 text-sm num text-right">{fmtUSD(e.cost_usd)}</td>
                      <td className="py-2.5 px-4 text-sm num text-right text-muted-foreground">{fmtUSD(e.avg_cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs font-mono text-muted-foreground flex justify-between">
                <span>{top.length} of {top.length} rows</span>
                <Link to="/app" className="link-underline">open full console →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hairline-t">
        <div className="max-w-[1100px] mx-auto px-8 py-10 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-serif text-base">TokenWatch</span>
            <span className="text-muted-foreground ml-3">— made quietly, in the open.</span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#" className="link-underline">Docs</a>
            <a href="#" className="link-underline">GitHub</a>
            <a href="#" className="link-underline">API</a>
            <a href="#" className="link-underline">Contact</a>
          </nav>
          <div className="text-xs font-mono text-muted-foreground">© 2026 · MIT</div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

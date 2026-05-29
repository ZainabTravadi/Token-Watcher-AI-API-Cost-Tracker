import { Link } from "react-router-dom";
import { fmtUSD, fmtNum } from "@/lib/data";
import { PageLoadingState } from "@/components/AsyncState";

const Index = () => {
  // Landing preview intentionally avoids fake telemetry; prompts users
  // to open the console for a live workspace preview.
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
      <section className="max-w-[1100px] mx-auto px-8 pt-20 pb-16 grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-8">
          <div className="label-mono mb-4">Issue 04 · May 2026 · v0.4.1</div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[56px] leading-tight tracking-tight mb-6">
            Know exactly where your<br />
            <em className="font-serif italic">AI money</em> is going.
          </h1>
          <p className="text-lg max-w-xl text-foreground/80 leading-relaxed mb-6">
            Install the SDK, copy your Workspace ID from the sidebar, grab your API key from Settings → API Keys, and see telemetry stream live.
            Track every request, every token, and every dollar across your endpoints.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/app" className="btn-rect h-11 px-5 text-sm shadow-sm">Open Console</Link>
            <a href="#install" className="btn-rect-ghost h-11 px-4 text-sm">How it works</a>
            <div className="w-full mt-4 text-sm text-muted-foreground font-mono">SDK-first · Realtime telemetry · Local-first persistence</div>
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
              ["Real-time accounting", "Every call to your AI providers or internal gateways is logged with token counts and resolved cost the moment it returns."],
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
              <div>npm install @zn_/tokenwatch</div>
              <div className="text-muted-foreground mt-3"># 2. wrap your client</div>
              <div><span className="text-muted-foreground">import</span> {"{ TokenWatch }"} <span className="text-muted-foreground">from</span> <span>"@zn_/tokenwatch"</span></div>
              <div><span className="text-muted-foreground">await</span> TokenWatch.track(<span className="text-muted-foreground">"llm.request.completed"</span>, {"{ route, provider, model, cost_usd }"})</div>
              <div className="text-muted-foreground mt-3"># 3. that's it. open the console.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Console preview (no fake demo data shown) */}
      <section className="hairline">
        <div className="max-w-[1100px] mx-auto px-8 py-16 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-3">
            <div className="label-mono">§ 03</div>
            <h2 className="font-serif text-2xl mt-2">From the console</h2>
            <p className="text-sm text-muted-foreground mt-3">Open your workspace to see live telemetry, costs, and activity.</p>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="border border-hairline bg-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="label-mono">console preview</div>
                <div className="text-xs font-mono text-muted-foreground">live · scrubbed</div>
              </div>
              <div className="space-y-3">
                <div className="h-3 bg-secondary/40 rounded w-[60%]" />
                <div className="h-3 bg-secondary/30 rounded w-[45%]" />
                <div className="h-3 bg-secondary/20 rounded w-[80%]" />
              </div>
              <div className="mt-6 flex items-center gap-4">
                <Link to="/app" className="btn-rect">Open Console</Link>
                <a href="#install" className="btn-rect-ghost">How it works</a>
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

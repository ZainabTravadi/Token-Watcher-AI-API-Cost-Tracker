import { NavLink, useLocation } from "react-router-dom";
import { ReactNode } from "react";

const nav = [
  { label: "Overview", to: "/app" },
  { label: "Endpoints", to: "/app/endpoints" },
  { label: "Models", to: "/app/models" },
  { label: "Requests", to: "/app/requests" },
  { label: "Settings", to: "/app/settings" },
];

export default function AppLayout({ children, title, meta }: { children: ReactNode; title: string; meta?: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="hairline">
        <div className="max-w-[1320px] mx-auto px-8 h-12 flex items-center justify-between">
          <NavLink to="/" className="flex items-baseline gap-2">
            <span className="font-serif text-lg leading-none">TokenWatch</span>
            <span className="label-mono">v0.4.1 · console</span>
          </NavLink>
          <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
            <span>env: <span className="text-foreground">production</span></span>
            <span>region: <span className="text-foreground">us-east-1</span></span>
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-positive rounded-full" /> live
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-[1320px] mx-auto px-8 grid grid-cols-[180px_1fr] gap-12">
        {/* Sidebar */}
        <aside className="pt-10">
          <div className="label-mono mb-4">Navigation</div>
          <nav className="flex flex-col">
            {nav.map((n) => {
              const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/app"}
                  className={`py-1.5 text-sm border-l-2 pl-3 -ml-px transition-colors ${
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="label-mono mt-10 mb-3">Workspace</div>
          <div className="text-sm">acme-prod</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">ws_8a4f…c021</div>

          <div className="label-mono mt-10 mb-3">Docs</div>
          <ul className="text-sm space-y-1.5">
            <li><a className="link-underline" href="#">Getting started</a></li>
            <li><a className="link-underline" href="#">SDK reference</a></li>
            <li><a className="link-underline" href="#">Webhooks</a></li>
          </ul>
        </aside>

        {/* Main */}
        <main className="pt-10 pb-24 min-w-0">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="label-mono mb-2">{pathname}</div>
              <h1 className="font-serif text-4xl leading-none">{title}</h1>
            </div>
            {meta && <div className="text-xs font-mono text-muted-foreground">{meta}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

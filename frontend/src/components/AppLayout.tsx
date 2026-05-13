import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { useHealthQuery, useSimulatorStatusQuery, useTelemetryStreamStatus } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, LogOut } from "lucide-react";

const nav = [
  { label: "Overview", to: "/app" },
  { label: "Endpoints", to: "/app/endpoints" },
  { label: "Models", to: "/app/models" },
  { label: "Requests", to: "/app/requests" },
  { label: "Settings", to: "/app/settings" },
];

export default function AppLayout({ children, title, meta }: { children: ReactNode; title: string; meta?: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, workspaces, currentWorkspace, setCurrentWorkspace, logout } = useAuth();
  const health = useHealthQuery();
  const simulator = useSimulatorStatusQuery();
  const streamStatus = useTelemetryStreamStatus();

  const liveLabel = health.isLoading
    ? "connecting"
    : health.isError || !health.data
      ? "offline"
      : `${health.data.telemetryRows.toLocaleString()} rows`;
  const pipelineLabel = streamStatus === "live"
    ? `live · ${liveLabel}`
    : streamStatus === "reconnecting"
      ? `reconnecting · ${liveLabel}`
      : streamStatus === "closed"
        ? `offline · ${liveLabel}`
        : `warming up · ${liveLabel}`;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    const workspace = workspaces?.find((ws) => ws.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
    }
  };

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
            <span>env: <span className="text-foreground">{health.data?.environment ?? "development"}</span></span>
            <span>db: <span className="text-foreground">{health.data?.database ?? "connecting"}</span></span>
            <span className="inline-flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${health.isError ? "bg-negative" : "bg-positive"}`} />
              {pipelineLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${streamStatus === "live" ? "bg-positive" : streamStatus === "reconnecting" ? "bg-amber-500" : "bg-muted-foreground"}`} />
              stream: {streamStatus}
            </span>
            
            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {user?.email}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

          {/* Workspace Selector */}
          <div className="label-mono mt-10 mb-3">Workspace</div>
          {currentWorkspace && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start p-0 h-auto font-normal text-sm hover:bg-accent">
                    <span className="truncate">{currentWorkspace.name}</span>
                    <ChevronDown className="h-3 w-3 ml-auto flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {workspaces?.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleWorkspaceChange(ws.id)}
                      className={currentWorkspace.id === ws.id ? "bg-accent" : ""}
                    >
                      {ws.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="text-xs text-muted-foreground font-mono mt-1 truncate" title={currentWorkspace.id}>
                {currentWorkspace.id.slice(0, 8)}…
              </div>
            </>
          )}

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

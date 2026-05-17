import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
import { ChevronDown, Copy, Check } from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", to: "/app" },
  { label: "Endpoints", to: "/app/endpoints" },
  { label: "Models", to: "/app/models" },
  { label: "Requests", to: "/app/requests" },
  { label: "Settings", to: "/app/settings" },
];

const DOCS_LINKS = [
  { label: "Getting started", href: "/docs/getting-started", external: false },
  { label: "SDK reference", href: "/docs/sdk-reference", external: false },
  { label: "Webhooks", href: "/docs/webhooks", external: false },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [activeNavIndex, setActiveNavIndex] = useState<number>(-1);
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // Determine active nav item
  useEffect(() => {
    const activeIndex = NAV_ITEMS.findIndex((item) => {
      if (item.to === "/app") {
        return pathname === "/app";
      }
      return pathname.startsWith(item.to);
    });
    setActiveNavIndex(activeIndex);
  }, [pathname]);

  // Handle workspace switch with loading state
  const handleWorkspaceChange = useCallback(
    async (workspaceId: string) => {
      const workspace = workspaces?.find((ws) => ws.id === workspaceId);
      if (!workspace || workspace.id === currentWorkspace?.id) {
        return;
      }

      setIsSwitching(true);
      try {
        setCurrentWorkspace(workspace);
        // Let auth context handle the state update
        // Component will naturally re-render when currentWorkspace changes
      } finally {
        setIsSwitching(false);
      }
    },
    [workspaces, currentWorkspace, setCurrentWorkspace]
  );

  // Copy workspace ID to clipboard
  const handleCopyWorkspaceId = useCallback(async () => {
    if (!currentWorkspace) return;

    try {
      await navigator.clipboard.writeText(currentWorkspace.id);
      setCopiedId(true);
      const timer = setTimeout(() => setCopiedId(false), 2000);
      return () => clearTimeout(timer);
    } catch (err) {
      console.error("Failed to copy workspace ID:", err);
    }
  }, [currentWorkspace]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle arrow keys and Enter within nav context
      if (!document.activeElement?.closest("nav")) {
        return;
      }

      const itemCount = NAV_ITEMS.length;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = activeNavIndex + 1 < itemCount ? activeNavIndex + 1 : 0;
          navRefs.current[nextIndex]?.focus();
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = activeNavIndex - 1 >= 0 ? activeNavIndex - 1 : itemCount - 1;
          navRefs.current[prevIndex]?.focus();
          break;
        }

        case "Home": {
          e.preventDefault();
          navRefs.current[0]?.focus();
          break;
        }

        case "End": {
          e.preventDefault();
          navRefs.current[itemCount - 1]?.focus();
          break;
        }

        case "Enter": {
          if (document.activeElement?.tagName === "A") {
            (document.activeElement as HTMLAnchorElement).click();
          }
          break;
        }

        default: {
          break;
        }
      }
    },
    [activeNavIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <aside className="pt-10">
      {/* Navigation Section */}
      <div className="label-mono mb-4">Navigation</div>
      <nav className="flex flex-col" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map((item, index) => {
          const isActive = activeNavIndex === index;
          return (
            <NavLink
              key={item.to}
              ref={(el) => {
                navRefs.current[index] = el;
              }}
              to={item.to}
              end={item.to === "/app"}
              tabIndex={isActive ? 0 : -1}
              className={`py-1.5 text-sm border-l-2 pl-3 -ml-px transition-all duration-150 ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Workspace Section */}
      <div className="label-mono mt-10 mb-3">Workspace</div>
      {currentWorkspace ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-0 h-auto font-normal text-sm hover:bg-gray-100 transition-colors duration-150 disabled:opacity-50"
                disabled={isSwitching}
              >
                <span className="truncate">{currentWorkspace.name}</span>
                <ChevronDown
                  className={`h-3 w-3 ml-auto flex-shrink-0 transition-transform duration-200 ${
                    isSwitching ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {workspaces?.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleWorkspaceChange(ws.id)}
                  className={`transition-colors duration-150 ${
                    currentWorkspace.id === ws.id ? "bg-gray-100" : ""
                  }`}
                  disabled={isSwitching}
                >
                  <span className="truncate">{ws.name}</span>
                  {currentWorkspace.id === ws.id && (
                    <span className="ml-auto text-xs text-muted-foreground">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Workspace ID with Copy */}
          <button
            onClick={handleCopyWorkspaceId}
            disabled={isSwitching}
            className="w-full text-left text-xs text-muted-foreground font-mono mt-2 py-1 px-0 rounded transition-colors duration-150 hover:text-foreground hover:bg-gray-50 disabled:opacity-50 flex items-center justify-between group"
            title={currentWorkspace.id}
            aria-label={`Copy workspace ID: ${currentWorkspace.id}`}
          >
            <span className="truncate">{currentWorkspace.id.slice(0, 8)}…</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1 flex-shrink-0">
              {copiedId ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </span>
          </button>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">No workspace selected</div>
      )}

      {/* Docs Section */}
      <div className="label-mono mt-10 mb-3">Docs</div>
      <ul className="text-sm space-y-1.5">
        {DOCS_LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="link-underline transition-colors duration-150 hover:text-foreground"
            >
              {link.label}
              {link.external && <span className="ml-1 text-xs">↗</span>}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

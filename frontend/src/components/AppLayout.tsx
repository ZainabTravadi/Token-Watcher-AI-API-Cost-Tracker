import { useLocation, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalStatusHeader } from "@/components/GlobalStatusHeader";
import { Sidebar } from "@/components/Sidebar";
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

export default function AppLayout({ children, title, meta }: { children: ReactNode; title: string; meta?: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalStatusHeader />

        <div className="border-b border-hairline bg-background">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 font-mono text-[11px] text-muted-foreground hover:bg-secondary/50 hover:text-foreground">
                  <span className="max-w-[220px] truncate">{user?.email}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-hairline bg-background font-mono text-xs shadow-none">
                <DropdownMenuLabel className="max-w-[260px] truncate font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-negative focus:bg-secondary/70 focus:text-negative">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-6 lg:gap-12">
        {/* Sidebar */}
        <Sidebar />

        {/* Main */}
        <main className="pt-4 lg:pt-10 pb-20 lg:pb-24 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
            <div>
              <div className="label-mono mb-2">{pathname}</div>
              <h1 className="font-serif text-3xl sm:text-4xl leading-none">{title}</h1>
            </div>
            {meta && <div className="text-xs font-mono text-muted-foreground">{meta}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

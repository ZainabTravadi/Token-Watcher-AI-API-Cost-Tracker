import { useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { API_BASE_URL } from "@/lib/api";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import NotFound from "./pages/NotFound.tsx";
import Overview from "./pages/app/Overview.tsx";
import Endpoints from "./pages/app/Endpoints.tsx";
import Models from "./pages/app/Models.tsx";
import Requests from "./pages/app/Requests.tsx";
import Settings from "./pages/app/Settings.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2_000,
    },
  },
});

function LiveRefreshBridge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only start streaming when user is authenticated
    if (!user) {
      return;
    }

    const source = new EventSource(`${API_BASE_URL}/api/telemetry/stream`, {
      withCredentials: true
    });

    const refresh = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["telemetry-rows"] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["simulator-status"] });
    };

    source.addEventListener("telemetry", refresh);
    source.addEventListener("seeded", refresh);
    source.addEventListener("connected", refresh);

    return () => {
      source.close();
    };
  }, [user, queryClient]);
  
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <LiveRefreshBridge />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Overview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/endpoints"
              element={
                <ProtectedRoute>
                  <Endpoints />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/models"
              element={
                <ProtectedRoute>
                  <Models />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/requests"
              element={
                <ProtectedRoute>
                  <Requests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

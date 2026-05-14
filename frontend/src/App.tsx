import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { StatusProvider } from "@/contexts/StatusContext";
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

const router = createBrowserRouter(
  [
    { path: "/", element: <Index /> },
    { path: "/login", element: <Login /> },
    { path: "/signup", element: <Signup /> },
    {
      path: "/app",
      element: (
        <ProtectedRoute>
          <Overview />
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/endpoints",
      element: (
        <ProtectedRoute>
          <Endpoints />
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/models",
      element: (
        <ProtectedRoute>
          <Models />
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/requests",
      element: (
        <ProtectedRoute>
          <Requests />
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/settings",
      element: (
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      ),
    },
    { path: "*", element: <NotFound /> },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <StatusProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} />
        </TooltipProvider>
      </StatusProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

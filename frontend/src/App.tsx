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
import React, { Suspense } from "react";
import { PageLoadingState } from "./components/AsyncState";

const Overview = React.lazy(() => import("./pages/app/Overview.tsx"));
const Endpoints = React.lazy(() => import("./pages/app/Endpoints.tsx"));
const Models = React.lazy(() => import("./pages/app/Models.tsx"));
const Requests = React.lazy(() => import("./pages/app/Requests.tsx"));
const Settings = React.lazy(() => import("./pages/app/Settings.tsx"));
const DocsPage = React.lazy(() => import("./pages/docs/DocsPage.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2_000,
    },
  },
});

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

const router = createBrowserRouter(
  [
    { path: "/", element: <Index /> },
    { path: "/login", element: <Login /> },
    { path: "/signup", element: <Signup /> },
    {
      path: "/app",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={5} />}>
            <Overview />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/endpoints",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={4} />}>
            <Endpoints />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/models",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={4} />}>
            <Models />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/requests",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={6} />}>
            <Requests />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    {
      path: "/app/settings",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={3} />}>
            <Settings />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    {
      path: "/docs/getting-started",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={2} />}>
            <DocsPage slug="getting-started" />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    {
      path: "/docs/sdk-reference",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={2} />}>
            <DocsPage slug="sdk-reference" />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    {
      path: "/docs/webhooks",
      element: (
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingState rows={2} />}>
            <DocsPage slug="webhooks" />
          </Suspense>
        </ProtectedRoute>
      ),
    },
    { path: "*", element: <NotFound /> },
  ],
  { future: routerFuture }
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <StatusProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} future={routerFuture} />
        </TooltipProvider>
      </StatusProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

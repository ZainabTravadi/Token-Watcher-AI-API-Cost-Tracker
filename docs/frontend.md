# Frontend

Frontend is React 18 + Vite + React Query + Tailwind/shadcn. Main entry is `frontend/src/App.tsx`.

## App Tree

```text
App
  QueryClientProvider
    AuthProvider
      StatusProvider
        TooltipProvider
          Toaster/Sonner
          RouterProvider
            ProtectedRoute
              AppLayout
                Sidebar
                GlobalStatusHeader
                page content
```

## Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `pages/Index.tsx` | public entry |
| `/login` | `pages/Login.tsx` | login form |
| `/signup` | `pages/Signup.tsx` | signup form |
| `/app` | `pages/app/Overview.tsx` | overview dashboard |
| `/app/endpoints` | `pages/app/Endpoints.tsx` | endpoint analytics |
| `/app/models` | `pages/app/Models.tsx` | model/provider analytics |
| `/app/requests` | `pages/app/Requests.tsx` | request log |
| `/app/settings` | `pages/app/Settings.tsx` | workspace/settings/API keys |
| `/docs/*` | `pages/docs/DocsPage.tsx` | docs pages |

## State Owners

| File | Owns |
|---|---|
| `contexts/AuthContext.tsx` | user, workspaces, current workspace, session, auth loading/error, login/signup/logout/refresh |
| `contexts/StatusContext.tsx` | health, stream status, last telemetry event time, single EventSource |
| `lib/api.ts` | API base URL, auth fetch, auth invalidation, stream status external store, query hooks |
| `pages/app/Requests.tsx` | request filters, sorting, pagination/cursor, selected row |
| `pages/app/Settings.tsx` | settings form orchestration |
| `hooks/useOverviewFilters.ts` | overview/date/entity/status filters over telemetry rows |

## API Client

`frontend/src/lib/api.ts` owns:

- `API_BASE_URL`
- `authFetch`
- `fetchHealth`
- `fetchAnalyticsSnapshot`
- `fetchTelemetryRows`
- `fetchRequestLog`
- `fetchAiInsights`
- `useHealthQuery`
- `useAnalyticsSnapshotQuery`
- `useTelemetryRowsQuery`
- `useRequestLogQuery`

Settings-specific calls live in `frontend/src/pages/app/settings/api.ts`.

## Component Ownership

| Component/folder | Purpose |
|---|---|
| `AppLayout.tsx` | app shell |
| `Sidebar.tsx` | app/docs nav |
| `GlobalStatusHeader.tsx` | health/SSE badges |
| `ProtectedRoute.tsx` | auth gate |
| `DataTable.tsx` | generic table |
| `RequestDetailDrawer.tsx` | selected request details |
| `BudgetAlertCard.tsx` | budget alert visual and pure derivation helper |
| `SdkOnboarding.tsx` | SDK setup snippets |
| `components/overview/*` | overview charts, KPIs, filters, export |
| `components/analytics/*` | entity charts, health, recommendations |
| `components/ui/*` | shadcn/Radix primitives; avoid for domain logic |

## Frontend Rules

- Do not create duplicate `EventSource`; `StatusContext` owns SSE.
- Keep reusable API calls in `lib/api.ts`; keep settings-only calls in `settings/api.ts`.
- Preserve current workspace localStorage key `tokenwatch.currentWorkspaceId`.
- Keep chart components prop-driven.
- Use existing shadcn primitives and local visual style.
- For API contract changes, update frontend types and backend route/service together.

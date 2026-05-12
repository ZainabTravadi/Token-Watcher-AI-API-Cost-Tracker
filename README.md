# TokenWatch

TokenWatch is a simulated AI observability platform for tracking requests, token usage, latency, cost, and errors across LLM-powered endpoints. Day 1 ships with a Node.js + TypeScript backend, a React dashboard, SQLite persistence, and a live telemetry simulator so the UI feels active immediately without calling any real LLM APIs.

## Features

- Express + TypeScript backend
- SQLite persistence with automatic initialization
- Simulated telemetry for OpenAI and Anthropic providers
- Simulated models: `gpt-4o`, `gpt-4o-mini`, `claude-sonnet`, `claude-haiku`
- Realistic traffic patterns, spikes, daily trends, and occasional errors
- Live dashboard updates via polling and SSE
- Dynamic overview, endpoints, models, and request tables
- Health endpoint and CORS support
- Clean modular architecture for swapping in real providers later

## Architecture Overview

- `backend/src/core` handles app and server bootstrap.
- `backend/src/db` owns the SQLite singleton and schema initialization.
- `backend/src/services` contains telemetry generation, simulation, analytics aggregation, and repository logic.
- `backend/src/routes` exposes health, telemetry, requests, and analytics APIs.
- `frontend/src/lib/api.ts` is the single API client and React Query integration point.
- `frontend/src/pages` renders dashboard screens from backend data instead of local mock arrays.
- `frontend/src/components/AsyncState.tsx` provides loading and error states across the dashboard.
- `sdk/` contains the lightweight TokenWatch TypeScript SDK for browser and Node.js consumers.

```mermaid
flowchart LR
	A[SDK demo app] -->|fetch + retry + batch| B[Backend /ingest]
	B --> C[(SQLite requests table)]
	C --> D[Analytics engine]
	D --> E[Frontend dashboard]
	B --> F[SSE live updates]
	F --> E
```
## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

### 2. Run the backend

```bash
cd backend
npm run dev
```

Backend defaults:
- Server URL: `http://localhost:3001`
- API base path: `/api`
- SQLite database file: `backend/data/tokenwatch.sqlite`
```

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

```bash
cd sdk
npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

The backend starts the demo SDK publisher automatically and exposes the ingest API at `http://localhost:3001/api/ingest`.

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

### 4. Use the SDK

```ts
import { TokenWatch } from "tokenwatch";

TokenWatch.init({
  apiUrl: "http://localhost:3001",
  projectId: "demo-app"
});

TokenWatch.track("request.completed", {
  properties: { route: "/api/chat", status: 200 }
});

TokenWatch.simulate({
  provider: "openai",
  model: "gpt-4o",
  endpoint: "/api/chat"
});
```

## Integration Example

The SDK demo app in [sdk/examples/demo.ts](sdk/examples/demo.ts) is the same shape a customer app would use. It initializes the client, starts simulation, and sends events over `fetch` to the backend ingest API.

If you want to wire your own app, point `apiUrl` at the backend and send telemetry through `TokenWatch.init()` plus `TokenWatch.simulate()` or `TokenWatch.track()`.

### 3. Run the frontend

```bash
cd frontend
npm run dev
```

Frontend defaults:
- App URL: `http://localhost:8080`
- API URL: `http://localhost:3001`

If you need a different API origin, set:

```bash
VITE_TOKENWATCH_API_URL=http://localhost:3001
```

## Run Commands

### Backend

```bash
npm run dev
npm run build
npm run start
npm run seed
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
```

## Demo Screenshots

Add screenshots here when capturing the product demo.

- `docs/screenshots/overview.png`
- `docs/screenshots/endpoints.png`
- `docs/screenshots/models.png`
- `docs/screenshots/requests.png`
- `docs/screenshots/sdk-demo.png`
- `docs/screenshots/ingest-terminal.png`

## What You Should See

- A polished startup banner in the terminal with server URL, database status, simulated telemetry status, request count, and analytics summary.
- The dashboard loading real analytics from the backend instead of hardcoded arrays.
- Tables and charts refreshing as the simulator inserts new rows into SQLite.
- Visible live activity even on a fresh start because the backend seeds historical telemetry automatically.

## Future Roadmap

- Add real provider adapters for OpenAI and Anthropic behind the same repository interface.
- Add workspace-level filters, teams, and API key management.
- Add exports for CSV, JSON, and warehouse sinks.
- Add alerting rules and budget notifications.
- Add route-level drilldowns with longer historical windows.
- Add auth and multi-workspace support.
- Add production deployment configuration and observability for the backend itself.

## SDK

The `sdk/` folder now contains a standalone `tokenwatch` package with a Firebase-style surface:

```ts
import { TokenWatch } from "tokenwatch";

TokenWatch.init({
	apiUrl: "http://localhost:4000",
	projectId: "demo-app"
});

TokenWatch.simulate({
	provider: "openai",
	model: "gpt-4o",
	endpoint: "/api/chat"
});
```

It exposes `init()`, `track()`, `simulate()`, `startSimulation()`, `stopSimulation()`, `identify()`, and `setEndpoint()` with no runtime dependencies.

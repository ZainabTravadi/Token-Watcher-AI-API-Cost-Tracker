# TokenWatch SDK

TokenWatch provides a small TypeScript SDK for sending telemetry to the backend.

## Quick Start

```bash
npm install @zn_/tokenwatch
```

```ts
import { TokenWatch } from "@zn_/tokenwatch";

TokenWatch.init({
  apiUrl: "https://your-tokenwatch-backend.example",
  apiKey: process.env.TOKENWATCH_API_KEY!,
});

await TokenWatch.track("llm.request.completed", {
  route: "/api/chat",
  provider: "openai",
  model: "gpt-4o",
  input_tokens: 120,
  output_tokens: 80,
  cost_usd: 0.0042,
  latency_ms: 640,
});

await TokenWatch.flush();
```

## What It Does

▪️ batches telemetry in a bounded queue
▪️ retries temporary failures
▪️ resolves workspace identity
▪️ flushes on shutdown

## Reference

The canonical SDK guide lives in [`../docs/sdk.md`](../docs/sdk.md).

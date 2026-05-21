declare const fetch: any;

async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function makeRecord() {
  const now = Date.now();
  return {
    timestamp: now,
    route: '/api/chat',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    input_tokens: Math.floor(Math.random()*1000)+10,
    output_tokens: Math.floor(Math.random()*500)+10,
    total_tokens: 0,
    cost_usd: 0,
    latency_ms: Math.floor(Math.random()*2000),
    error: null
  };
}

async function runIngest(apiUrl: string, apiKey: string, total: number, concurrency: number, batchSize: number) {
  console.log(`Ingest: total=${total} concurrency=${concurrency} batchSize=${batchSize}`);
  let sent = 0;
  let successes = 0;
  const start = Date.now();

  const workers: Promise<void>[] = [];

  for (let w = 0; w < concurrency; w++) {
    workers.push((async () => {
      while (sent < total) {
        const take = Math.min(batchSize, total - sent);
        if (take <= 0) break;
        // reserve
        sent += take;
        const batch = Array.from({length: take}, () => makeRecord());
        try {
          const res = await fetch(`${apiUrl}/api/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify(batch)
          });
          if (res.ok) {
            successes += 1;
          } else {
            const text = await res.text();
            console.warn('ingest failed', res.status, text);
          }
        } catch (e) {
          console.error('ingest error', e);
        }
        await sleep(1);
      }
    })());
  }

  await Promise.all(workers);
  const duration = Date.now() - start;
  console.log(`Ingest completed: batches=${successes} duration_ms=${duration}`);
}

async function openSseClients(apiUrl: string, cookie: string, workspaceId: string, clients: number, durationMs: number) {
  console.log(`SSE: clients=${clients} durationMs=${durationMs}`);
  const readers: Promise<number>[] = [];

  for (let i = 0; i < clients; i++) {
    readers.push((async () => {
      const url = `${apiUrl}/api/telemetry/stream?workspaceId=${workspaceId}`;
      try {
        const res = await fetch(url, { headers: { Cookie: cookie } });
        if (!res.ok || !res.body) return 0;
        const reader = (res as any).body.getReader();
        let count = 0;
        const decoder = new TextDecoder();
        let buf = '';
        const start = Date.now();
        while (Date.now() - start < durationMs) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value);
          const parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (const p of parts) {
            if (!p.trim()) continue;
            count += 1;
          }
        }
        try { reader.cancel(); } catch {}
        return count;
      } catch (e) {
        console.error('SSE client error', e);
        return 0;
      }
    })());
  }

  const results = await Promise.all(readers);
  const totalEvents = results.reduce((a,b) => a+b, 0);
  console.log(`SSE clients done, totalEvents=${totalEvents}`);
}

async function main() {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const apiKey = process.env.API_KEY!;
  const cookie = process.env.COOKIE ?? '';
  const workspaceId = process.env.WORKSPACE_ID!;

  // Example run: ingest 5000 events as 1000 batches of 5 with concurrency 10
  await runIngest(apiUrl, apiKey, Number(process.env.INGEST_TOTAL ?? '5000'), Number(process.env.INGEST_CONC ?? '10'), Number(process.env.INGEST_BATCH ?? '5'));

  // Open SSE clients for 20 seconds
  await openSseClients(apiUrl, cookie, workspaceId, Number(process.env.SSE_CLIENTS ?? '10'), Number(process.env.SSE_DURATION_MS ?? '20000'));
}

void main().catch(e => { console.error(e); process.exit(1); });

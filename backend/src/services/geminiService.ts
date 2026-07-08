import type { AnalyticsSnapshot } from "../types/telemetry";

// Try to use Google genai client if available via env var GOOGLE_API_KEY
let GenAI: any = null;
try {
  // dynamic require to avoid import when not needed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GenAI = require("@google/genai");
} catch (e) {
  GenAI = null;
}

function generateInsightsLocally(summary: any): string[] {
  const insights: string[] = [];

  try {
    const total = Number(summary.totalSpend ?? 0);
    const budget = Number(summary.budget ?? 0);
    const providers = summary.providerBreakdown ?? {};
    const sortedProviders = Object.entries(providers).sort((a, b) => (b[1] as number) - (a[1] as number));
    const topProviderEntry = sortedProviders[0];
    if (topProviderEntry) {
      const [topProvider, topAmount] = topProviderEntry;
      const pct = total > 0 ? Math.round((Number(topAmount) / total) * 100) : 0;
      insights.push(`${topProvider} accounts for ${pct}% of spend.`);
    }

    if (budget > 0 && total > 0) {
      const daysLeft = Math.max(1, Math.round((budget - total) / (total / 30 || 1)));
      if (total > budget) {
        insights.push(`Current spend has exceeded the configured budget of ${budget}.`);
      } else {
        insights.push(`Current spend trend suggests budget exhaustion within ${daysLeft} day(s).`);
      }
    }

    if (summary.averageLatency && summary.averageLatency > 1000) {
      insights.push(`Average latency is ${Math.round(summary.averageLatency)}ms — consider investigating slow endpoints.`);
    } else {
      insights.push(`Latency trends look healthy (avg ${Math.round(summary.averageLatency ?? 0)}ms).`);
    }

    if (summary.failureRate && summary.failureRate > 0.05) {
      insights.push(`Failure rate is ${((summary.failureRate ?? 0) * 100).toFixed(1)}% — consider error budget or retries.`);
    }

    // provider optimization suggestion
    const alt = sortedProviders.find(([k]) => /Gemini/i.test(String(k)));
    if (alt) {
      insights.push(`Consider moving low-compute/low-token workloads to ${alt[0]} to reduce costs.`);
    } else if (sortedProviders.length > 1) {
      insights.push(`Evaluate cheaper providers for non-critical workloads.`);
    }
  } catch (e) {
    insights.push("No insights available");
  }

  return insights.filter(Boolean).slice(0, 8);
}

export async function generateInsightsWithGemini(summary: any): Promise<string[]> {
  const url = process.env.GEMINI_API_URL;
  const key = process.env.GEMINI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GENAI_API_KEY || process.env.GEMINI_API_KEY;

  // Build a higher-quality prompt (Senior FinOps Consultant)
  const prompt = `You are a Senior AI FinOps Consultant.\n\nAnalyze the provided AI infrastructure analytics JSON and return exactly the following sections as JSON with keys: \"costOptimization\", \"budgetRisk\", \"providerRecommendation\", \"performanceObservation\", \"executiveSummary\".\n\nRequirements:\n- Reference actual numbers from the analytics.\n- Be specific and identify savings opportunities.\n- Highlight cost concentration risk.\n- Mention budget concerns when relevant.\n- Explain your reasoning concisely like an enterprise FinOps advisor.\n\nANALYTICS_JSON:\n${JSON.stringify(summary)}`;

  // Use @google/genai GoogleGenAI client when available
  if (googleKey && GenAI) {
    console.log('[AI INSIGHTS] Provider: Gemini (via @google/genai)');
    const model = process.env.GEMINI_MODEL || process.env.GENAI_MODEL || 'gemini-2.5-flash';
    console.log('[AI INSIGHTS] Model:', model);
    console.log('[AI INSIGHTS] Gemini client initializing');
    try {
      const ai = new GenAI.GoogleGenAI({ apiKey: googleKey });
      console.log('[AI INSIGHTS] Gemini client initialized');

      console.log('[AI INSIGHTS] Sending prompt');
      const response = await ai.models.generateContent({ model, contents: prompt });
      console.log('[AI INSIGHTS] Response received');

      console.log('[AI INSIGHTS] Response Received (genai):', JSON.stringify(response).slice(0, 4000));
      const text = response?.text || (response?.candidates && response.candidates.map((c: any) => c.output).join('\n')) || response?.output_text || response?.content || '';
      console.log('[AI INSIGHTS] Response Parsed:', text.slice(0, 4000));

      if (!text) {
        throw new Error('Gemini returned no text');
      }

      return text.split(/\n+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 8);
    } catch (err: any) {
      console.error('[AI INSIGHTS] Gemini (genai) request failed', err?.message ?? err);
      // During debugging/tests we want to see the real error rather than fallback.
      throw err;
    }
  }

  console.log('[AI INSIGHTS] Provider: Local Heuristic Fallback');
  return generateInsightsLocally(summary);
}

export type { AnalyticsSnapshot };

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

async function main() {
  const GenAI = require("@google/genai");
  console.log('SDK keys sample:', Object.keys(GenAI).slice(0,30));
  console.log('SDK version:', GenAI.SDK_VERSION || GenAI.version || 'unknown');

  const envs = {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GENAI_API_KEY: process.env.GENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_URL: process.env.GEMINI_API_URL,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };
  console.log('Env vars detected:', envs);

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No API key found in GOOGLE_API_KEY/GENAI_API_KEY/GEMINI_API_KEY; aborting');
    process.exit(2);
  }

  const model = process.env.GEMINI_MODEL || process.env.GENAI_MODEL || 'gemini-2.5-flash';
  console.log('Using model:', model);

  try {
    const ai = new GenAI.GoogleGenAI({ apiKey });
    console.log('Created GoogleGenAI client');
    const resp = await ai.models.generateContent({ model, contents: 'Reply with the word SUCCESS' });
    console.log('Raw response:', JSON.stringify(resp).slice(0,4000));
    const text = resp?.text || (resp?.candidates && resp.candidates.map((c: any) => c.output).join('\n')) || resp?.output_text || '';
    console.log('Parsed text:', text);
    console.log('SUCCESS check:', text.includes('SUCCESS'));
  } catch (err: any) {
    console.error('Gemini test failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

void main();

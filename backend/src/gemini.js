// One place that talks to Gemini, with the guard-rails that keep a free key alive:
//  * a daily call budget (GEMINI_DAILY_LIMIT, default 60)
//  * model fallback list (GEMINI_MODELS) - each model has its own quota
//  * circuit breaker: after a 429 that model is paused instead of being hammered
import { canSpend, isTripped, spend, trip } from './quota.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const httpError = (status, message) => Object.assign(new Error(message), { status });

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
const models = () => (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-3.8-flash,gemini-3.5-flash-lite')
  .split(',').map((name) => name.trim()).filter(Boolean);

export function parseJsonOutput(text) {
  const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < start) throw httpError(502, 'Gemini returned an unreadable answer.');
  return JSON.parse(clean.slice(start, end + 1));
}

export async function geminiJson(prompt, { timeoutMs = 20000 } = {}) {
  if (!geminiConfigured()) throw httpError(503, 'Add GEMINI_API_KEY to backend/.env to enable AI summaries.');
  if (!canSpend('gemini')) throw httpError(429, 'Daily AI budget reached - using built-in summaries to protect your free quota.');
  let lastError = null;
  let paused = 0;
  const list = models();
  for (const model of list) {
    if (isTripped(`gemini:${model}`)) { paused += 1; continue; }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!canSpend('gemini')) throw httpError(429, 'Daily AI budget reached - using built-in summaries to protect your free quota.');
      spend('gemini');
      let response;
      let result;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({ model, input: prompt }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        result = await response.json().catch(() => ({}));
      } catch {
        lastError = httpError(504, 'Gemini did not respond in time.');
        break;
      }
      if (response.ok) {
        const text = result.output_text || (result.steps || []).flatMap((step) => step.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('\n');
        return parseJsonOutput(text);
      }
      if (response.status === 503 && attempt === 0) { await sleep(1200); continue; }
      if (response.status === 429) {
        const daily = /per.?day|daily/i.test(JSON.stringify(result.error || {}));
        trip(`gemini:${model}`, daily ? 6 * 3600 * 1000 : 5 * 60 * 1000);
        lastError = httpError(429, 'Gemini free-tier limit reached; falling back.');
        break;
      }
      if (response.status === 400 || response.status === 404) {
        trip(`gemini:${model}`, 10 * 60 * 1000);
        lastError = httpError(502, result.error?.message || `Gemini rejected model ${model}.`);
        break;
      }
      lastError = httpError(502, result.error?.message || 'Gemini request failed.');
      break;
    }
  }
  if (paused === list.length) throw httpError(429, 'Gemini free-tier limit reached - using built-in summaries for now.');
  throw lastError || httpError(503, 'Gemini is unavailable right now.');
}

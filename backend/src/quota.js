// Daily API budgets + circuit breakers, so free-tier keys are never exhausted.
// Limits are deliberately below the providers' real free limits; override in .env.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const usageFile = `${dataDir}usage.json`;
const today = () => new Date().toISOString().slice(0, 10);
const num = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) >= 0 && value !== undefined && value !== '' ? Number(value) : fallback);
const breakers = new Map();
let state = null;

function current() {
  if (state?.date === today()) return state;
  let saved = null;
  try { saved = JSON.parse(readFileSync(usageFile, 'utf8')); } catch { /* first run */ }
  state = saved?.date === today() ? saved : { date: today(), counts: {} };
  return state;
}

function persist() {
  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(`${usageFile}.tmp`, JSON.stringify(state));
    renameSync(`${usageFile}.tmp`, usageFile);
  } catch { /* budget tracking must never break a request */ }
}

export const limits = () => ({
  gemini: num(process.env.GEMINI_DAILY_LIMIT, 60),
  gnews: num(process.env.GNEWS_DAILY_LIMIT, 80),
  newsdata: num(process.env.NEWSDATA_DAILY_LIMIT, 150),
});

export const used = (provider) => current().counts[provider] || 0;
export const canSpend = (provider) => used(provider) < (limits()[provider] ?? 0);

export function spend(provider, amount = 1) {
  const s = current();
  s.counts[provider] = (s.counts[provider] || 0) + amount;
  persist();
}

export function trip(key, ms) { breakers.set(key, Date.now() + ms); }
export function isTripped(key) {
  const until = breakers.get(key);
  if (!until) return false;
  if (until <= Date.now()) { breakers.delete(key); return false; }
  return true;
}

export const usageSummary = () => Object.fromEntries(Object.entries(limits()).map(([name, limit]) => [name, { used: used(name), limit }]));

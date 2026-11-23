// Integration test of the news -> AI -> geocode -> road-link pipeline with fake network + DB calls.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const backup = `${dataDir}geocodes.backup.json`;
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODELS = 'model-a';
process.env.GEMINI_DAILY_LIMIT = '3';

const rss = (items) => `<?xml version="1.0"?><rss><channel>${items.map(([title, link]) => `<item><title>${title} - Test Paper</title><link>${link}</link><pubDate>${new Date(Date.now() - 86400000).toUTCString()}</pubDate><description>${title} details</description><source url="https://t.example">Test Paper</source></item>`).join('')}</channel></rss>`;

let geminiCalls = 0;
let geminiMode = 'ok';
let articlesByArea = {};
const storedOps = [];

before(async () => {
  if (existsSync(`${dataDir}geocodes.json`)) copyFileSync(`${dataDir}geocodes.json`, backup);
  global.fetch = async (url) => {
    const href = String(url);
    if (href.includes('news.google.com')) {
      const area = decodeURIComponent(href).includes('Jodhpur') ? 'Jodhpur' : 'Jaipur';
      return new Response(rss(articlesByArea[area]), { status: 200 });
    }
    if (href.includes('generativelanguage')) {
      geminiCalls += 1;
      if (geminiMode === '429') return new Response(JSON.stringify({ error: { message: 'quota exceeded per day' } }), { status: 429 });
      const out = { incidents: [
        { index: 0, relevant: true, summary: 'A truck overturned.', placeName: 'Ajmer Road', type: 'accident', confidence: 'high' },
        { index: 1, relevant: true, summary: 'Crash near Shahpura.', placeName: 'Delhi-Jaipur highway', type: 'accident', confidence: 'medium' },
        { index: 2, relevant: false, summary: 'Awareness event.', placeName: null, type: 'other', confidence: 'high' },
      ] };
      return new Response(JSON.stringify({ output_text: JSON.stringify(out) }), { status: 200 });
    }
    if (href.includes('nominatim')) return new Response(JSON.stringify([{ lat: '26.90', lon: '75.78', display_name: 'Somewhere, Jaipur', addresstype: 'road' }]), { status: 200 });
    throw new Error(`unexpected fetch ${href}`);
  };
  const { Location, NewsIncident, RoadSegment } = await import('../src/models.js');
  RoadSegment.find = () => ({ lean: async () => [
    { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Ajmer Road (Jaipur)', slug: 'ajmer-road', aliases: ['\\bajmer road\\b'] },
    { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Delhi–Jaipur Highway (NH-48)', slug: 'dj', aliases: ['delhi[\\s\\-–]+jaipur\\s+(highway|expressway|road)'] },
  ] });
  Location.findOneAndUpdate = async () => ({ id: 'loc1' });
  NewsIncident.bulkWrite = async (ops) => { storedOps.push(...ops); };
});

after(() => {
  if (existsSync(backup)) { copyFileSync(backup, `${dataDir}geocodes.json`); rmSync(backup); }
  for (const f of ['summaries.json', 'usage.json']) rmSync(`${dataDir}${f}`, { force: true });
});

test('first search: one Gemini call, irrelevant article dropped, roads linked, incidents stored', async () => {
  articlesByArea.Jaipur = [['Truck overturns on Ajmer Road', 'https://t.example/1'], ['Crash on Delhi-Jaipur highway near Shahpura', 'https://t.example/2'], ['World Day of Remembrance event held', 'https://t.example/3']];
  const { getIncidents } = await import('../src/incidents.js');
  const result = await getIncidents('Jaipur, India');
  assert.equal(geminiCalls, 1);
  assert.equal(result.incidents.length, 2);
  assert.equal(result.incidents[0].roadName, 'Ajmer Road (Jaipur)');
  assert.equal(result.incidents[1].roadId, 'bbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(result.incidents[0].summarySource, 'gemini');
  assert.equal(result.ai.summarized, 2);
  assert.equal(storedOps.length, 2);
});

test('forced refresh re-uses cached summaries: zero extra Gemini calls', async () => {
  const { getIncidents } = await import('../src/incidents.js');
  const before = geminiCalls;
  const result = await getIncidents('Jaipur, India', { refresh: true });
  assert.equal(geminiCalls, before);
  assert.equal(result.incidents.length, 2);
  assert.equal(result.ai.note, '');
});

test('Gemini 429 falls back to excerpts instead of failing; model is then paused', async () => {
  articlesByArea.Jodhpur = [['Car crash on highway near Jodhpur', 'https://t.example/10']];
  geminiMode = '429';
  const { getIncidents } = await import('../src/incidents.js');
  const before = geminiCalls;
  const result = await getIncidents('Jodhpur, India');
  assert.equal(geminiCalls, before + 1);
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].summarySource, 'source_excerpt');
  assert.match(result.ai.note, /limit/i);
  // second attempt for a new article must not even call Gemini (breaker is open)
  articlesByArea.Jodhpur = [['Truck fire on bypass near Jodhpur', 'https://t.example/11']];
  await getIncidents('Jodhpur, India', { refresh: true });
  assert.equal(geminiCalls, before + 1);
});

test('daily budget: calls stop once the limit is reached', async () => {
  const { canSpend, spend, used } = await import('../src/quota.js');
  while (canSpend('gemini')) spend('gemini');
  assert.equal(used('gemini'), 3);
  geminiMode = 'ok';
  articlesByArea.Jodhpur = [['Another pothole crash in Jodhpur', 'https://t.example/12']];
  const { getIncidents } = await import('../src/incidents.js');
  const before = geminiCalls;
  const result = await getIncidents('Jodhpur, India', { refresh: true });
  assert.equal(geminiCalls, before);
  assert.equal(result.incidents[0].summarySource, 'source_excerpt');
  assert.match(result.ai.note, /budget/i);
});

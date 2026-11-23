// End-to-end check of safety scoring over the DEMO dataset, using fake DB queries and a fake routing service.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
delete process.env.GEMINI_API_KEY;

const chain = (rows) => { const q = { sort: () => q, limit: () => q, lean: async () => rows }; return q; };
const withIds = (rows, prefix) => rows.map((row, i) => ({ ...row, _id: `${prefix}${i}` }));
let routing;

before(async () => {
  const { seedPlaces, seedRoads, seedZones, seedReports } = await import('../src/seedData.js');
  const { Place, RoadSegment, RiskZone, CommunityReport, NewsIncident } = await import('../src/models.js');
  const places = withIds(seedPlaces(), 'p'); const roads = withIds(seedRoads(), 'r');
  const zones = withIds(seedZones(), 'z'); const reports = withIds(seedReports(), 'c');
  RoadSegment.find = () => chain(roads);
  RiskZone.find = () => chain(zones);
  CommunityReport.find = () => chain(reports);
  NewsIncident.find = () => chain([]);
  Place.find = (filter = {}) => chain(places.filter((p) => (!filter.lat || (p.lat >= filter.lat.$gte && p.lat <= filter.lat.$lte)) && (!filter.lng || (p.lng >= filter.lng.$gte && p.lng <= filter.lng.$lte))));
  global.fetch = async (url) => {
    assert.match(String(url), /\/route\/v1\/driving\//);
    return new Response(JSON.stringify(routing), { status: 200 });
  };
});
after(() => rmSync(`${dataDir}usage.json`, { force: true }));

test('a busy transit hub with reports is higher-risk than a well-lit market, and worse at night', async () => {
  const { assessPoint } = await import('../src/safety.js');
  const hub = await assessPoint(26.9226, 75.7946, { night: false });
  const market = await assessPoint(26.8545, 75.8080, { night: false });
  const hubNight = await assessPoint(26.9226, 75.7946, { night: true });
  assert.ok(['RED', 'ORANGE'].includes(hub.level), hub.level);
  assert.equal(market.level, 'GREEN');
  assert.ok(market.safety > hub.safety);
  assert.ok(hubNight.safety <= hub.safety);
  assert.ok(hub.nearbyPlaces.length > 0 && hub.tips.length >= 2);
  assert.match(hub.tips.join(' '), /Nearest help point/);
});

test('route safety recommends the route that avoids the risky road, with a clear explanation', async () => {
  const { routeSafety } = await import('../src/safety.js');
  // Route 0: fastest, runs along Tonk Road (ORANGE). Route 1: 4 min slower, runs along JLN Marg (GREEN).
  const tonk = [[26.8995, 75.795], [26.8745, 75.7945], [26.85, 75.7985], [26.8245, 75.806]];
  const jln = [[26.8995, 75.795], [26.8965, 75.8075], [26.878, 75.8165], [26.86, 75.812], [26.8445, 75.8062], [26.8245, 75.806]];
  const toGeo = (path) => ({ type: 'LineString', coordinates: path.map(([lat, lng]) => [lng, lat]) });
  routing = { code: 'Ok', routes: [{ distance: 8000, duration: 900, geometry: toGeo(tonk) }, { distance: 9500, duration: 1140, geometry: toGeo(jln) }] };
  const result = await routeSafety({ lat: 26.8995, lng: 75.795 }, { lat: 26.8245, lng: 75.806 }, { night: false });
  assert.equal(result.routes.length, 2);
  assert.equal(result.fastestIndex, 0);
  assert.equal(result.recommendedIndex, 1);
  assert.equal(result.routes[0].label, 'Fastest');
  assert.equal(result.routes[1].label, 'Safest');
  assert.ok(result.routes[1].safetyScore > result.routes[0].safetyScore);
  assert.ok(result.routes[0].hotspots.some((h) => /Tonk Road/.test(h.name)));
  assert.match(result.advice, /4 min longer/);
  assert.ok(result.routes[0].path.length <= 500);
});

test('route safety reports routing failures cleanly', async () => {
  const { routeSafety } = await import('../src/safety.js');
  routing = { code: 'NoRoute', routes: [] };
  await assert.rejects(() => routeSafety({ lat: 26.9, lng: 75.8 }, { lat: 26.8, lng: 75.8 }), (e) => e.status === 404);
  await assert.rejects(() => routeSafety({ lat: 26.9, lng: 75.8 }, { lat: 10, lng: 75.8 }), (e) => e.status === 400);
});

test('briefing works with no AI key and flags the worst areas', async () => {
  const { getBriefing } = await import('../src/briefing.js');
  const b = await getBriefing('Jaipur, India', { night: true });
  assert.equal(b.source, 'rules');
  assert.match(b.headline, /high-risk/);
  assert.ok(b.tips.length >= 3);
  assert.match(b.note, /GEMINI_API_KEY/);
});

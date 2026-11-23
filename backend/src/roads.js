import { RoadSegment } from './models.js';
import { decimate } from './geo.js';
import { matchRoad } from './roadMatch.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let cache = { at: 0, roads: [] };

// Roads change rarely, so incident loading shares a short-lived cache instead of querying per article.
export async function getRoadsCached() {
  if (Date.now() - cache.at < 60000 && cache.roads.length) return cache.roads;
  const roads = await RoadSegment.find({}, { slug: 1, name: 1, aliases: 1 }).lean();
  cache = { at: Date.now(), roads: roads.map((r) => ({ ...r, id: String(r._id) })) };
  return cache.roads;
}
export const invalidateRoadCache = () => { cache = { at: 0, roads: [] }; };
export const matchRoadForText = async (text) => matchRoad(text, await getRoadsCached());

const esc = (value) => String(value).replace(/[\\"]/g, '\\$&');

// Fetches the real road shape from OpenStreetMap (Overpass API: free, no key).
export async function fetchOsmPaths(road) {
  const [south, west, north, east] = road.bbox || [];
  if (![south, west, north, east].every(Number.isFinite)) return null;
  const selector = road.osm?.ref ? `["ref"~"${esc(road.osm.ref)}"]` : road.osm?.name ? `["name"~"^(${esc(road.osm.name)})$",i]` : null;
  if (!selector) return null;
  const query = `[out:json][timeout:25];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]${selector}(${south},${west},${north},${east});out geom 400;`;
  const response = await fetch(process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SafeTravel/1.0 (road safety map)' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
  const { elements = [] } = await response.json();
  const paths = elements
    .filter((el) => el.type === 'way' && el.geometry?.length > 1)
    .map((el) => el.geometry.map((pt) => [pt.lat, pt.lon]))
    .sort((a, b) => b.length - a.length)
    .slice(0, 60)
    .map((path) => decimate(path, 250));
  return paths.length ? paths : null;
}

let running = null;
export function refreshRoadGeometry(options) {
  if (!running) running = runRefresh(options).finally(() => { running = null; });
  return running;
}

async function runRefresh({ force = false } = {}) {
  const roads = await RoadSegment.find(force ? {} : { geometrySource: { $ne: 'osm' } });
  const results = [];
  for (const road of roads) {
    try {
      const paths = await fetchOsmPaths(road);
      if (paths) {
        road.paths = paths;
        road.markModified('paths');
        road.geometrySource = 'osm';
        road.geometryFetchedAt = new Date();
        await road.save();
        results.push({ slug: road.slug, ok: true, ways: paths.length });
      } else results.push({ slug: road.slug, ok: false, reason: 'no matching road found in OpenStreetMap' });
    } catch (error) {
      results.push({ slug: road.slug, ok: false, reason: error.message });
    }
    await sleep(2000); // be polite to the free public Overpass server
  }
  invalidateRoadCache();
  return results;
}

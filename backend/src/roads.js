import { RoadSegment } from './models.js';
import { decimate } from './geo.js';
import { matchRoad } from './roadMatch.js';
import { curvedRoads } from './curvedRoads.js';

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

// Fetches the real road shape from OpenStreetMap (via OSRM road geometry or Overpass API).
export async function fetchOsmPaths(road) {
  // First priority: fetch continuous road geometry via OSRM along waypoints
  if (road.waypoints?.length >= 2) {
    try {
      const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
      const coordsStr = road.waypoints.map((p) => `${p[1]},${p[0]}`).join(';');
      const response = await fetch(`${base}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`, {
        headers: { 'User-Agent': 'SafeTravel/1.0 (road safety map)' },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        const coords = data.routes?.[0]?.geometry?.coordinates;
        if (coords?.length > 1) {
          const path = coords.map(([lng, lat]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
          return [decimate(path, 120)];
        }
      }
    } catch {
      // fallback to overpass below
    }
  }

  // Second priority: Overpass API query within bounding box
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
      if (!road.waypoints?.length) {
        const match = curvedRoads.find((c) => c.slug === road.slug);
        if (match?.waypoints) road.waypoints = match.waypoints;
      }
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
    await sleep(1000);
  }
  invalidateRoadCache();
  return results;
}

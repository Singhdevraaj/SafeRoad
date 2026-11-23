// Pure risk-scoring logic: no database, no network. Everything the map colours come from here.
import { decimate, distanceToPath, distanceToPaths, expandBounds, haversine, inBounds, pathsBounds, samplePath } from './geo.js';

export const LEVEL_WEIGHT = { GREEN: 0, YELLOW: 1, ORANGE: 2.5, RED: 5 };
export const levelFromScore = (score) => (score >= 7 ? 'RED' : score >= 4 ? 'ORANGE' : score >= 2 ? 'YELLOW' : 'GREEN');

const DAY_MS = 86400000;
const round1 = (value) => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Newer evidence counts more: weight halves every `halfLifeDays`.
export function decay(date, now = Date.now(), halfLifeDays = 60) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return 1;
  return 0.5 ** (Math.max(0, now - t) / (halfLifeDays * DAY_MS));
}

export const REPORT_WEIGHTS = {
  accident: 2, road_hazard: 1.2, dangerous_driving: 1.5, traffic_disruption: 0.6, weather_hazard: 0.8,
  harassment: 2.2, poor_lighting: 1.2, suspicious_activity: 1.5, unsafe_area: 1.8, other: 0.7,
};

export function reportWeight(report, now = Date.now()) {
  if (report.status === 'REJECTED') return 0;
  const base = REPORT_WEIGHTS[report.category] ?? 0.7;
  const trust = report.status === 'VERIFIED' ? 1.5 : 1;
  return base * trust * decay(report.createdAt, now);
}

export function incidentWeight(incident, now = Date.now()) {
  const base = incident.type === 'accident' || incident.type === 'vehicle_fire' ? 2
    : incident.type === 'harassment' || incident.type === 'crime' ? 2.2 : 1.2;
  return base * decay(incident.publishedAt || incident.createdAt, now);
}

// After dark, women-safety zones are riskier than road zones; roads get a smaller bump.
export const timeMultiplier = (kind, night) => (!night ? 1 : kind === 'women' ? 1.6 : kind === 'road' ? 1.25 : 1.4);

// Caps stop a single person (or bot) from painting a whole area red on their own.
const REPORT_CAP = 8;
const NEWS_CAP = 6;

export function scoreRoad(road, { reports = [], incidents = [], night = false, now = Date.now(), radiusM = 150 } = {}) {
  const bounds = road.paths?.length ? pathsBounds(road.paths) : null;
  const box = bounds ? expandBounds(bounds, radiusM) : null;
  const near = box ? reports.filter((r) => inBounds([r.lat, r.lng], box) && distanceToPaths([r.lat, r.lng], road.paths) <= radiusM) : [];
  const roadId = String(road._id ?? road.id ?? '');
  const linked = incidents.filter((i) => i.roadId && String(i.roadId) === roadId);
  const reportSum = Math.min(REPORT_CAP, near.reduce((sum, r) => sum + reportWeight(r, now), 0));
  const newsSum = Math.min(NEWS_CAP, linked.reduce((sum, i) => sum + incidentWeight(i, now), 0));
  const raw = (road.baseScore || 0) + reportSum + newsSum;
  const score = round1(raw * timeMultiplier('road', night));
  return {
    score, rawScore: round1(raw), level: levelFromScore(score),
    counts: { reports: near.length, verifiedReports: near.filter((r) => r.status === 'VERIFIED').length, news: linked.length },
  };
}

export function scoreZone(zone, { reports = [], incidents = [], night = false, now = Date.now() } = {}) {
  const center = [zone.lat, zone.lng];
  const reach = zone.radiusM * 1.15;
  const near = reports.filter((r) => haversine(center, [r.lat, r.lng]) <= reach);
  const linked = incidents.filter((i) => Number.isFinite(i.lat) && haversine(center, [i.lat, i.lng]) <= reach);
  const reportSum = Math.min(REPORT_CAP, near.reduce((sum, r) => sum + reportWeight(r, now), 0));
  const newsSum = Math.min(NEWS_CAP, linked.reduce((sum, i) => sum + incidentWeight(i, now), 0));
  const raw = (zone.baseScore || 0) + reportSum + newsSum;
  const score = round1(raw * timeMultiplier(zone.kind, night));
  return {
    score, rawScore: round1(raw), level: levelFromScore(score),
    counts: { reports: near.length, verifiedReports: near.filter((r) => r.status === 'VERIFIED').length, news: linked.length },
  };
}

// Groups reports that are not inside any known zone into community "hotspots".
export function clusterHotspots(reports, { cell = 0.004, minWeight = 3, minCount = 2, now = Date.now(), max = 12 } = {}) {
  const buckets = new Map();
  for (const r of reports) {
    const weight = reportWeight(r, now);
    if (weight <= 0) continue;
    const key = `${Math.floor(r.lat / cell)}:${Math.floor(r.lng / cell)}`;
    const b = buckets.get(key) || { weight: 0, count: 0, lat: 0, lng: 0, categories: {} };
    b.weight += weight; b.count += 1; b.lat += r.lat * weight; b.lng += r.lng * weight;
    b.categories[r.category] = (b.categories[r.category] || 0) + 1;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .filter((b) => b.count >= minCount && b.weight >= minWeight)
    .map((b) => ({
      lat: b.lat / b.weight, lng: b.lng / b.weight, radiusM: 250, weight: round1(b.weight), count: b.count,
      dominantCategory: Object.entries(b.categories).sort((x, y) => y[1] - x[1])[0][0],
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
}

// 0-100 "how safe does this point look" (higher is safer), from the worst nearby risk and nearby help.
export function pointSafety({ riskScores = [], helpCount = 0 }) {
  const sorted = [...riskScores].sort((a, b) => b - a);
  const risk = (sorted[0] || 0) + 0.35 * (sorted[1] || 0);
  const safety = clamp(Math.round(100 - risk * 9 + Math.min(15, helpCount * 3)), 0, 100);
  return { safety, level: levelFromScore(risk), risk: round1(risk) };
}

// Walks along a route and totals how much of it runs through risky roads/zones.
export function analyzeRoute(path, { roads = [], zones = [], places = [], stepM = 100, roadReachM = 60, supportReachM = 400 } = {}) {
  const samples = samplePath(path, stepM);
  const riskyRoads = roads
    .filter((r) => r.level !== 'GREEN' && r.paths?.length)
    .map((r) => ({ ...r, box: expandBounds(pathsBounds(r.paths), roadReachM + 20) }));
  const riskyZones = zones.filter((z) => z.level !== 'GREEN');
  let riskKm = 0;
  let distanceM = 0;
  const hits = new Map();
  for (const { point, meters } of samples) {
    distanceM += meters;
    let weight = 0;
    let hit = null;
    for (const road of riskyRoads) {
      if (!inBounds(point, road.box) || distanceToPaths(point, road.paths) > roadReachM) continue;
      const w = LEVEL_WEIGHT[road.level];
      if (w > weight) { weight = w; hit = { type: 'road', id: String(road.id), name: road.name, level: road.level }; }
    }
    for (const zone of riskyZones) {
      if (haversine(point, [zone.lat, zone.lng]) > zone.radiusM) continue;
      const w = LEVEL_WEIGHT[zone.level];
      if (w > weight) { weight = w; hit = { type: 'zone', id: String(zone.id), name: zone.name, level: zone.level }; }
    }
    riskKm += (weight * meters) / 1000;
    if (hit) {
      const key = `${hit.type}:${hit.id}`;
      const entry = hits.get(key) || { ...hit, meters: 0 };
      entry.meters += meters;
      hits.set(key, entry);
    }
  }
  const distanceKm = distanceM / 1000;
  const avgWeight = riskKm / Math.max(distanceKm, 0.3);
  const coarse = decimate(path, 400);
  const support = {};
  for (const place of places) {
    if (place.status === 'REJECTED') continue;
    if (distanceToPath([place.lat, place.lng], coarse) <= supportReachM) support[place.category] = (support[place.category] || 0) + 1;
  }
  return {
    distanceKm: round1(distanceKm),
    riskKm: round1(riskKm),
    safetyScore: clamp(Math.round(100 - avgWeight * 22), 0, 100),
    level: levelFromScore(avgWeight * 2.2),
    hotspots: [...hits.values()].map((h) => ({ ...h, meters: Math.round(h.meters) })).sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] || b.meters - a.meters).slice(0, 6),
    supportPlaces: support,
  };
}

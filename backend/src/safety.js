// Data-loading + orchestration around the pure scoring in risk.js.
import { CommunityReport, NewsIncident, Place, RiskZone, RoadSegment } from './models.js';
import { analyzeRoute, clusterHotspots, levelFromScore, pointSafety, scoreRoad, scoreZone, timeMultiplier } from './risk.js';
import { decimate, distanceToPaths, expandBounds, haversine, pathsBounds } from './geo.js';

const SIX_MONTHS = 183 * 86400000;
const round1 = (value) => Math.round(value * 10) / 10;
const httpError = (status, message) => Object.assign(new Error(message), { status });
const WOMEN_CATEGORIES = new Set(['harassment', 'poor_lighting', 'suspicious_activity', 'unsafe_area']);
export const HELP_CATEGORIES = new Set(['women_safe', 'police', 'hospital', 'public_place', 'transport']);

async function loadEvidence() {
  const since = new Date(Date.now() - SIX_MONTHS);
  const [reports, incidents] = await Promise.all([
    CommunityReport.find({ createdAt: { $gte: since }, status: { $ne: 'REJECTED' } }).sort({ createdAt: -1 }).limit(3000).lean(),
    NewsIncident.find({ publishedAt: { $gte: since } }).limit(3000).lean(),
  ]);
  return { reports, incidents };
}

export async function getScoredRoads({ night = false } = {}) {
  const [roads, { reports, incidents }] = await Promise.all([RoadSegment.find().lean(), loadEvidence()]);
  return roads.map((road) => ({
    id: String(road._id), slug: road.slug, name: road.name, kind: road.kind, paths: road.paths || [], reasons: road.reasons || [],
    geometrySource: road.geometrySource, source: road.source, ...scoreRoad(road, { reports, incidents, night }),
  }));
}

export async function getScoredZones({ night = false } = {}) {
  const [zones, { reports, incidents }] = await Promise.all([RiskZone.find().lean(), loadEvidence()]);
  const located = incidents.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
  const scored = zones.map((zone) => ({
    id: String(zone._id), name: zone.name, kind: zone.kind, lat: zone.lat, lng: zone.lng, radiusM: zone.radiusM,
    reasons: zone.reasons || [], source: zone.source, ...scoreZone(zone, { reports, incidents: located, night }),
  }));
  // Reports that fall outside every known zone but cluster together become automatic "community hotspots".
  const outside = reports.filter((r) => zones.every((z) => haversine([z.lat, z.lng], [r.lat, r.lng]) > z.radiusM * 1.15));
  const hotspots = clusterHotspots(outside).map((h, i) => {
    const kind = WOMEN_CATEGORIES.has(h.dominantCategory) ? 'women' : 'road';
    const score = round1(Math.min(8, h.weight) * timeMultiplier(kind, night));
    return {
      id: `hotspot-${i}`, name: 'Community hotspot', kind, lat: h.lat, lng: h.lng, radiusM: h.radiusM,
      reasons: [`${h.count} community reports in this spot`], source: 'community', score, rawScore: round1(h.weight),
      level: levelFromScore(score), counts: { reports: h.count, verifiedReports: 0, news: 0 },
    };
  });
  return [...scored, ...hotspots];
}

async function placesNear(lat, lng, radiusM) {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const rows = await Place.find({ status: { $ne: 'REJECTED' }, lat: { $gte: lat - dLat, $lte: lat + dLat }, lng: { $gte: lng - dLng, $lte: lng + dLng } }).lean();
  return rows.map((p) => ({ id: String(p._id), name: p.name, category: p.category, status: p.status, lat: p.lat, lng: p.lng, distanceM: Math.round(haversine([lat, lng], [p.lat, p.lng])) }))
    .filter((p) => p.distanceM <= radiusM).sort((a, b) => a.distanceM - b.distanceM);
}

export async function assessPoint(lat, lng, { night = false } = {}) {
  const [roads, zones, nearby] = await Promise.all([getScoredRoads({ night }), getScoredZones({ night }), placesNear(lat, lng, 1500)]);
  const here = [lat, lng];
  const coveringZones = zones.filter((z) => haversine(here, [z.lat, z.lng]) <= z.radiusM);
  const closeRoads = roads.filter((r) => distanceToPaths(here, r.paths) <= 120);
  const help = nearby.filter((p) => p.distanceM <= 800 && HELP_CATEGORIES.has(p.category));
  const result = pointSafety({ riskScores: [...coveringZones.map((z) => z.score), ...closeRoads.map((r) => r.score)], helpCount: help.length });
  const tips = [];
  if (result.level === 'RED' || result.level === 'ORANGE') {
    tips.push(night ? 'Avoid walking alone here after dark - use a cab and share your live location.' : 'Higher-risk area: stay on main, well-lit roads and keep valuables out of sight.');
  }
  const top = [...coveringZones, ...closeRoads].sort((a, b) => b.score - a.score)[0];
  if (top?.reasons?.[0]) tips.push(`${top.name}: ${top.reasons[0]}.`);
  const nearestHelp = nearby.find((p) => HELP_CATEGORIES.has(p.category));
  tips.push(nearestHelp ? `Nearest help point: ${nearestHelp.name} (${nearestHelp.distanceM} m).` : 'No help point found within 1.5 km - share your live location with someone you trust.');
  return {
    lat, lng, night, safety: result.safety, level: result.level, risk: result.risk,
    zones: coveringZones.map(({ id, name, level, score, kind }) => ({ id, name, level, score, kind })),
    roads: closeRoads.map(({ id, name, level, score }) => ({ id, name, level, score })),
    nearbyPlaces: nearby.slice(0, 6), tips,
  };
}

export async function routeSafety(from, to, { night = false } = {}) {
  if (haversine([from.lat, from.lng], [to.lat, to.lng]) > 800000) throw httpError(400, 'Choose points less than 800 km apart.');
  const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
  const url = `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  let data;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'SafeTravel/1.0 (safety route check)' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    data = await response.json();
  } catch {
    throw httpError(502, 'The routing service is unavailable right now. Please try again in a minute.');
  }
  if (data.code !== 'Ok' || !data.routes?.length) throw httpError(404, 'No drivable route found between those two points.');
  const paths = data.routes.map((route) => route.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
  const box = expandBounds(pathsBounds(paths), 600);
  const [roads, zones, rows] = await Promise.all([
    getScoredRoads({ night }), getScoredZones({ night }),
    Place.find({ status: { $ne: 'REJECTED' }, lat: { $gte: box[0], $lte: box[2] }, lng: { $gte: box[1], $lte: box[3] } }).lean(),
  ]);
  const places = rows.map((p) => ({ lat: p.lat, lng: p.lng, category: p.category, status: p.status }));
  const routes = data.routes.map((route, i) => {
    const analysis = analyzeRoute(paths[i], { roads, zones, places });
    return { index: i, ...analysis, distanceKm: round1(route.distance / 1000), durationMin: Math.round(route.duration / 60), path: decimate(paths[i], 500) };
  });
  const byRisk = [...routes].sort((a, b) => a.riskKm - b.riskKm || a.durationMin - b.durationMin);
  const byTime = [...routes].sort((a, b) => a.durationMin - b.durationMin);
  const safest = byRisk[0].index;
  const fastest = byTime[0].index;
  routes.forEach((r) => { r.label = r.index === safest && r.index === fastest ? 'Safest & fastest' : r.index === safest ? 'Safest' : r.index === fastest ? 'Fastest' : 'Alternative'; });
  let advice = 'Based on sample + community data, not live traffic. Share your trip with someone you trust.';
  if (safest !== fastest) {
    const extra = routes[safest].durationMin - routes[fastest].durationMin;
    advice = `The safest route is ${extra > 0 ? `${extra} min longer` : 'no slower'} and scores ${routes[safest].safetyScore}/100 vs ${routes[fastest].safetyScore}/100 for the fastest.`;
  } else if (routes[safest].hotspots.length) {
    advice = `No safer alternative found. Stay alert near ${routes[safest].hotspots[0].name}.`;
  }
  return { night, recommendedIndex: safest, fastestIndex: fastest, routes, advice };
}

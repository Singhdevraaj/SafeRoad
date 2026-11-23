import test from 'node:test';
import assert from 'node:assert/strict';
import { haversine, distanceToPath, samplePath, decimate } from '../src/geo.js';
import { levelFromScore, scoreRoad, scoreZone, clusterHotspots, analyzeRoute, pointSafety, reportWeight, decay } from '../src/risk.js';
import { nextStatus, castVote } from '../src/trust.js';
import { matchRoad } from '../src/roadMatch.js';

const NOW = Date.UTC(2026, 10, 22);
const road = { id: 'r1', _id: 'r1', name: 'Test Road', baseScore: 3, paths: [[[26.90, 75.80], [26.90, 75.82]]] };

test('haversine: 0.01 deg of latitude is about 1.1 km', () => {
  const d = haversine([26.9, 75.8], [26.91, 75.8]);
  assert.ok(d > 1100 && d < 1120, String(d));
});

test('distanceToPath: point ~111 m north of an east-west road', () => {
  const d = distanceToPath([26.901, 75.81], road.paths[0]);
  assert.ok(d > 105 && d < 117, String(d));
});

test('samplePath covers the full length', () => {
  const total = samplePath(road.paths[0], 100).reduce((s, x) => s + x.meters, 0);
  assert.ok(Math.abs(total - haversine(road.paths[0][0], road.paths[0][1])) < 1);
});

test('decimate keeps endpoints and respects the cap', () => {
  const p = Array.from({ length: 1000 }, (_, i) => [i, i]);
  const d = decimate(p, 50);
  assert.equal(d.length, 50); assert.deepEqual(d[0], p[0]); assert.deepEqual(d.at(-1), p.at(-1));
});

test('level thresholds', () => {
  assert.deepEqual([1.9, 2, 3.9, 4, 6.9, 7].map(levelFromScore), ['GREEN', 'YELLOW', 'YELLOW', 'ORANGE', 'ORANGE', 'RED']);
});

test('decay halves after one half-life and rejected reports weigh nothing', () => {
  const sixtyDaysAgo = NOW - 60 * 86400000;
  assert.ok(Math.abs(decay(sixtyDaysAgo, NOW) - 0.5) < 1e-9);
  assert.equal(reportWeight({ category: 'accident', status: 'REJECTED', createdAt: NOW }, NOW), 0);
});

test('nearby verified reports push a road up; far ones do not', () => {
  const near = { lat: 26.9005, lng: 75.81, category: 'accident', status: 'VERIFIED', createdAt: NOW };
  const far = { lat: 26.95, lng: 75.81, category: 'accident', status: 'VERIFIED', createdAt: NOW };
  const base = scoreRoad(road, { now: NOW });
  const withNear = scoreRoad(road, { reports: [near, near], now: NOW });
  const withFar = scoreRoad(road, { reports: [far], now: NOW });
  assert.equal(base.level, 'YELLOW');
  assert.ok(withNear.score > base.score);
  assert.equal(withFar.score, base.score);
  assert.equal(withNear.counts.verifiedReports, 2);
});

test('report spam is capped', () => {
  const spam = Array.from({ length: 200 }, () => ({ lat: 26.9, lng: 75.81, category: 'accident', status: 'UNVERIFIED', createdAt: NOW }));
  assert.ok(scoreRoad(road, { reports: spam, now: NOW }).rawScore <= 3 + 8 + 0.01);
});

test('night makes women-safety zones riskier', () => {
  const zone = { lat: 26.9, lng: 75.8, radiusM: 400, baseScore: 3, kind: 'women' };
  assert.equal(scoreZone(zone, { now: NOW }).level, 'YELLOW');
  assert.equal(scoreZone(zone, { night: true, now: NOW }).level, 'ORANGE');
});

test('hotspots need several nearby reports', () => {
  const mk = (lat, lng) => ({ lat, lng, category: 'harassment', status: 'UNVERIFIED', createdAt: NOW });
  const hot = clusterHotspots([mk(26.9001, 75.8001), mk(26.9002, 75.8002), mk(26.9003, 75.8001)], { now: NOW });
  assert.equal(hot.length, 1); assert.equal(hot[0].dominantCategory, 'harassment');
  assert.equal(clusterHotspots([mk(26.9, 75.8), mk(27.5, 76.5)], { now: NOW }).length, 0);
});

test('a route along a red road is less safe than one that avoids it', () => {
  const red = { ...road, level: 'RED' };
  const along = [[26.9, 75.80], [26.9, 75.82]];
  const away = [[26.95, 75.80], [26.95, 75.82]];
  const a = analyzeRoute(along, { roads: [red] });
  const b = analyzeRoute(away, { roads: [red] });
  assert.ok(a.safetyScore < b.safetyScore, `${a.safetyScore} vs ${b.safetyScore}`);
  assert.equal(b.safetyScore, 100);
  assert.equal(a.hotspots[0].name, 'Test Road');
});

test('safe places count towards route support', () => {
  const r = analyzeRoute([[26.9, 75.80], [26.9, 75.82]], { places: [{ lat: 26.9005, lng: 75.81, category: 'police', status: 'VERIFIED' }, { lat: 27.5, lng: 75.81, category: 'police', status: 'VERIFIED' }] });
  assert.deepEqual(r.supportPlaces, { police: 1 });
});

test('point safety falls as risk rises and rises with nearby help', () => {
  assert.equal(pointSafety({ riskScores: [] }).safety, 100);
  assert.ok(pointSafety({ riskScores: [8] }).safety < pointSafety({ riskScores: [3] }).safety);
  assert.ok(pointSafety({ riskScores: [8], helpCount: 4 }).safety > pointSafety({ riskScores: [8] }).safety);
  assert.equal(pointSafety({ riskScores: [8] }).level, 'RED');
});

test('community verification thresholds', () => {
  assert.equal(nextStatus({ confirms: 2, disputes: 0, current: 'PENDING', pending: 'PENDING' }), 'PENDING');
  assert.equal(nextStatus({ confirms: 3, disputes: 0, current: 'PENDING', pending: 'PENDING' }), 'VERIFIED');
  assert.equal(nextStatus({ confirms: 3, disputes: 2, current: 'PENDING', pending: 'PENDING' }), 'PENDING');
  assert.equal(nextStatus({ confirms: 0, disputes: 3, current: 'PENDING', pending: 'PENDING' }), 'REJECTED');
  assert.equal(nextStatus({ confirms: 0, disputes: 5, current: 'VERIFIED', pending: 'PENDING', locked: true }), 'VERIFIED');
  assert.equal(nextStatus({ confirms: 1, disputes: 0, current: 'VERIFIED', pending: 'UNVERIFIED' }), 'UNVERIFIED');
});

test('one voter counts once and can switch sides', () => {
  let v = castVote({ confirms: [], disputes: [] }, 'a', 'confirm');
  v = castVote(v, 'a', 'confirm'); assert.deepEqual(v.confirms, ['a']);
  v = castVote(v, 'a', 'dispute'); assert.deepEqual(v, { confirms: [], disputes: ['a'] });
});

test('news headlines are matched to the right road', () => {
  const roads = [
    { id: 'ajmer', name: 'Ajmer Road', aliases: ['\\bajmer road\\b'] },
    { id: 'delhi', name: 'Delhi-Jaipur Highway', aliases: ['delhi[\\s\\-–]+jaipur\\s+(highway|expressway)'] },
  ];
  assert.equal(matchRoad('Three hurt in crash on Delhi-Jaipur highway near Shahpura', roads)?.id, 'delhi');
  assert.equal(matchRoad('Truck overturns on Ajmer Road', roads)?.id, 'ajmer');
  assert.equal(matchRoad('Festival crowds in the old city', roads), null);
  assert.equal(matchRoad('x', [{ id: 'bad', aliases: ['(['] }]), null);
});

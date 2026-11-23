// Small geometry helpers. All points are [lat, lng]; distances are in metres.
const EARTH_M = 6371008.8;
const rad = (deg) => (deg * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Distance from point p to the segment a-b (local flat-earth projection; accurate for short spans).
export function pointToSegmentM(p, a, b) {
  const kx = Math.cos(rad(p[0])) * rad(1) * EARTH_M;
  const ky = rad(1) * EARTH_M;
  const ax = (a[1] - p[1]) * kx;
  const ay = (a[0] - p[0]) * ky;
  const bx = (b[1] - p[1]) * kx;
  const by = (b[0] - p[0]) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanceToPath(p, path) {
  if (!path?.length) return Infinity;
  if (path.length === 1) return haversine(p, path[0]);
  let best = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const d = pointToSegmentM(p, path[i - 1], path[i]);
    if (d < best) best = d;
  }
  return best;
}

export const distanceToPaths = (p, paths = []) => paths.reduce((min, path) => Math.min(min, distanceToPath(p, path)), Infinity);

export function pathsBounds(paths = []) {
  let s = Infinity; let w = Infinity; let n = -Infinity; let e = -Infinity;
  for (const path of paths) for (const [lat, lng] of path) {
    if (lat < s) s = lat; if (lat > n) n = lat; if (lng < w) w = lng; if (lng > e) e = lng;
  }
  return Number.isFinite(s) ? [s, w, n, e] : null;
}

export function expandBounds([s, w, n, e], meters) {
  const dLat = meters / 111320;
  const dLng = meters / (111320 * Math.max(0.2, Math.cos(rad((s + n) / 2))));
  return [s - dLat, w - dLng, n + dLat, e + dLng];
}

export const inBounds = (p, [s, w, n, e]) => p[0] >= s && p[0] <= n && p[1] >= w && p[1] <= e;

export function decimate(path, max) {
  if (path.length <= max) return path;
  const step = (path.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => path[Math.round(i * step)]);
}

export function pathLengthM(path) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += haversine(path[i - 1], path[i]);
  return total;
}

// Evenly spaced samples along a path; each sample stands for `meters` of the path.
export function samplePath(path, stepM = 100) {
  const out = [];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const len = haversine(a, b);
    if (len === 0) continue;
    const n = Math.max(1, Math.round(len / stepM));
    for (let k = 0; k < n; k += 1) {
      const t = (k + 0.5) / n;
      out.push({ point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], meters: len / n });
    }
  }
  return out;
}

export const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

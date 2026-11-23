import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { CommunityReport, Location, PLACE_CATEGORIES, Place, REPORT_CATEGORIES, Review, User, Zone, ZoneHistory } from './models.js';
import { getIncidents } from './incidents.js';
import { assessPoint, getScoredRoads, getScoredZones, routeSafety } from './safety.js';
import { getBriefing } from './briefing.js';
import { refreshRoadGeometry } from './roads.js';
import { seedDatabase } from './seed.js';
import { geminiConfigured } from './gemini.js';
import { usageSummary } from './quota.js';
import { castVote, nextStatus } from './trust.js';
import { haversine, validPoint } from './geo.js';

const app = express();
const port = Number(process.env.PORT || 9080);
const jwtSecret = process.env.JWT_SECRET;

if (!process.env.MONGODB_URI || !jwtSecret) {
  console.error('MONGODB_URI and JWT_SECRET must be set in backend/.env');
  process.exit(1);
}

const configuredOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || [];
const localDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin) || localDevOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
}));
app.use(express.json({ limit: '32kb' }));

const adminEmails = new Set((process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
const isAdmin = (user) => Boolean(user && (user.role === 'ADMIN' || adminEmails.has(String(user.email).toLowerCase())));
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: isAdmin(user) ? 'ADMIN' : user.role, verified: user.verified });
// One vote per signed-in user; guests are told apart by IP so a single browser cannot stuff the ballot.
const voterKey = (req) => (req.user ? `u:${req.user.id}` : `ip:${createHash('sha1').update(String(req.ip)).digest('hex').slice(0, 12)}`);

// Tiny in-memory rate limiter for submit/vote endpoints (spam protection for a public demo).
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [key, value] of hits) if (value.reset <= now) hits.delete(key); }, windowMs).unref();
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const entry = hits.get(key) && hits.get(key).reset > now ? hits.get(key) : { count: 0, reset: now + windowMs };
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) return res.status(429).json({ message: 'Too many submissions. Please wait a few minutes and try again.' });
    return next();
  };
}
const submitLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });
const voteLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60 });
const requireAdmin = (req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ message: 'Only an admin can do that.' }));
const nightFlag = (req) => req.query.time === 'night';
const authToken = (user) => jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' });

app.get('/', (_req, res) => res.json({ name: 'SafeRoute API', health: '/api/health' }));
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.status(204).end());

async function optionalAuth(req, _res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try {
    const { sub } = jwt.verify(token, jwtSecret);
    req.user = await User.findById(sub);
  } catch { /* Public reports are allowed; invalid tokens do not identify a user. */ }
  next();
}

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  ai: { gemini: geminiConfigured(), usage: usageSummary() },
  news: { googleRss: true, gnews: Boolean(process.env.GNEWS_API_KEY), newsdata: Boolean(process.env.NEWSDATA_API_KEY) },
}));

app.get('/api/incidents', async (req, res, next) => {
  try { res.json(await getIncidents(req.query.location, { refresh: req.query.refresh === 'true', topic: req.query.topic === 'women' ? 'women' : 'road' })); } catch (error) { next(error); }
});

const publicReport = (r) => ({
  id: String(r._id ?? r.id), category: r.category, description: r.description, locationName: r.locationName, lat: r.lat, lng: r.lng,
  status: r.status, source: r.source, confirms: r.confirms?.length || 0, disputes: r.disputes?.length || 0, createdAt: r.createdAt,
});

const publicPlace = (p) => ({
  id: String(p._id ?? p.id), name: p.name, category: p.category, lat: p.lat, lng: p.lng, address: p.address, phone: p.phone, hours: p.hours,
  open24x7: p.open24x7, tags: p.tags || [], notes: p.notes, status: p.status, source: p.source,
  confirms: p.confirms?.length || 0, disputes: p.disputes?.length || 0, createdAt: p.createdAt,
});

function areaFilter(query, defaultRadiusKm = 100) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!validPoint(lat, lng) || query.lat === undefined || query.lng === undefined) return {};
  const radiusKm = Number(query.radiusKm);
  const radius = Number.isFinite(radiusKm) ? Math.min(Math.max(radiusKm, 1), 500) : defaultRadiusKm;
  const latDelta = radius / 111;
  const lngDelta = radius / Math.max(1, 111 * Math.cos(lat * Math.PI / 180));
  return { lat: { $gte: lat - latDelta, $lte: lat + latDelta }, lng: { $gte: lng - lngDelta, $lte: lng + lngDelta } };
}

const limitFrom = (value, fallback = 1000) => { const n = Number(value); return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 1000) : fallback; };

app.get('/api/reports', async (req, res, next) => {
  try {
    const reports = await CommunityReport.find({ ...areaFilter(req.query), status: { $ne: 'REJECTED' } }).sort({ createdAt: -1 }).limit(limitFrom(req.query.limit)).lean();
    res.json({ reports: reports.map(publicReport) });
  } catch (error) { next(error); }
});

app.post('/api/reports', optionalAuth, submitLimiter, async (req, res, next) => {
  try {
    const { category, description, locationName } = req.body ?? {};
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const cleanDescription = String(description || '').trim();
    const cleanLocationName = String(locationName || '').trim().slice(0, 180);
    if (!validPoint(lat, lng)) return res.status(400).json({ message: 'Choose a valid point on the map.' });
    if (!REPORT_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Choose a report category.' });
    if (cleanDescription.length < 5 || cleanDescription.length > 2000) return res.status(400).json({ message: 'Description must be between 5 and 2000 characters.' });
    const admin = isAdmin(req.user);
    const report = await CommunityReport.create({
      user: req.user?._id, category, description: cleanDescription, lat, lng,
      locationName: cleanLocationName || `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      status: admin ? 'VERIFIED' : 'UNVERIFIED', reviewedByAdmin: admin,
    });
    res.status(201).json({ report: publicReport(report) });
  } catch (error) { next(error); }
});

app.post('/api/reports/:id/vote', optionalAuth, voteLimiter, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Report not found.' });
    if (!['confirm', 'dispute'].includes(req.body?.vote)) return res.status(400).json({ message: 'Vote must be "confirm" or "dispute".' });
    const report = await CommunityReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    const votes = castVote(report, voterKey(req), req.body.vote);
    report.confirms = votes.confirms;
    report.disputes = votes.disputes;
    report.status = nextStatus({ confirms: votes.confirms.length, disputes: votes.disputes.length, current: report.status, pending: 'UNVERIFIED', locked: report.reviewedByAdmin });
    await report.save();
    res.json({ report: publicReport(report) });
  } catch (error) { next(error); }
});

app.patch('/api/reports/:id/status', optionalAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Report not found.' });
    if (!['UNVERIFIED', 'VERIFIED', 'REJECTED'].includes(req.body?.status)) return res.status(400).json({ message: 'Invalid status.' });
    const report = await CommunityReport.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status, reviewedByAdmin: true } }, { new: true });
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    res.json({ report: publicReport(report) });
  } catch (error) { next(error); }
});

// ---------- Safe places ----------
const PLACE_TAGS = ['cctv', 'female staff', 'well lit', 'security guard', 'emergency', 'trauma', 'rpf', '24x7 access', 'wheelchair access'];
const normName = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

app.get('/api/places', async (req, res, next) => {
  try {
    const categories = String(req.query.category || '').split(',').map((c) => c.trim()).filter((c) => PLACE_CATEGORIES.includes(c));
    const filter = { ...areaFilter(req.query, 50), status: { $ne: 'REJECTED' } };
    if (categories.length) filter.category = { $in: categories };
    const places = await Place.find(filter).sort({ status: -1, createdAt: -1 }).limit(limitFrom(req.query.limit)).lean();
    res.json({ places: places.map(publicPlace) });
  } catch (error) { next(error); }
});

app.post('/api/places', optionalAuth, submitLimiter, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const name = String(body.name || '').trim();
    if (!validPoint(lat, lng) || body.lat === undefined) return res.status(400).json({ message: 'Choose the place on the map first.' });
    if (!PLACE_CATEGORIES.includes(body.category)) return res.status(400).json({ message: 'Choose a place category.' });
    if (name.length < 2 || name.length > 140) return res.status(400).json({ message: 'Place name must be between 2 and 140 characters.' });
    const phone = String(body.phone || '').replace(/[^0-9+\-\s()]/g, '').trim().slice(0, 30);
    const tags = (Array.isArray(body.tags) ? body.tags : []).map((t) => String(t).toLowerCase()).filter((t) => PLACE_TAGS.includes(t)).slice(0, 8);
    // Block near-duplicates: same category, within ~40 m, similar name -> ask people to confirm the existing one.
    const nearby = await Place.find({ ...areaFilter({ lat, lng, radiusKm: 1 }), category: body.category, status: { $ne: 'REJECTED' } }).lean();
    const duplicate = nearby.find((p) => haversine([lat, lng], [p.lat, p.lng]) <= 40 && (normName(p.name).includes(normName(name)) || normName(name).includes(normName(p.name))));
    if (duplicate) return res.status(409).json({ message: `"${duplicate.name}" is already on the map here. Open it and tap Confirm instead.`, existingId: String(duplicate._id) });
    const admin = isAdmin(req.user);
    const place = await Place.create({
      name, category: body.category, lat, lng, phone, tags,
      address: String(body.address || '').trim().slice(0, 240), hours: String(body.hours || '').trim().slice(0, 80),
      open24x7: Boolean(body.open24x7), notes: String(body.notes || '').trim().slice(0, 500),
      status: admin ? 'VERIFIED' : 'PENDING', source: admin ? 'admin' : 'community', reviewedByAdmin: admin, submittedBy: req.user?._id,
    });
    res.status(201).json({ place: publicPlace(place) });
  } catch (error) { next(error); }
});

app.post('/api/places/:id/vote', optionalAuth, voteLimiter, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Place not found.' });
    if (!['confirm', 'dispute'].includes(req.body?.vote)) return res.status(400).json({ message: 'Vote must be "confirm" or "dispute".' });
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ message: 'Place not found.' });
    const votes = castVote(place, voterKey(req), req.body.vote);
    place.confirms = votes.confirms;
    place.disputes = votes.disputes;
    place.status = nextStatus({ confirms: votes.confirms.length, disputes: votes.disputes.length, current: place.status, pending: 'PENDING', locked: place.reviewedByAdmin });
    await place.save();
    res.json({ place: publicPlace(place) });
  } catch (error) { next(error); }
});

app.patch('/api/places/:id/status', optionalAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Place not found.' });
    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(req.body?.status)) return res.status(400).json({ message: 'Invalid status.' });
    const place = await Place.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status, reviewedByAdmin: true } }, { new: true });
    if (!place) return res.status(404).json({ message: 'Place not found.' });
    res.json({ place: publicPlace(place) });
  } catch (error) { next(error); }
});

// ---------- Risk layers: coloured roads/highways and zones ----------
app.get('/api/roads', async (req, res, next) => {
  try { res.json({ night: nightFlag(req), roads: await getScoredRoads({ night: nightFlag(req) }) }); } catch (error) { next(error); }
});

app.get('/api/zones', async (req, res, next) => {
  try { res.json({ night: nightFlag(req), zones: await getScoredZones({ night: nightFlag(req) }) }); } catch (error) { next(error); }
});

app.get('/api/safety', async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!validPoint(lat, lng) || req.query.lat === undefined) return res.status(400).json({ message: 'Provide a valid lat and lng.' });
    res.json(await assessPoint(lat, lng, { night: nightFlag(req) }));
  } catch (error) { next(error); }
});

app.post('/api/route/safety', async (req, res, next) => {
  try {
    const from = { lat: Number(req.body?.from?.lat), lng: Number(req.body?.from?.lng) };
    const to = { lat: Number(req.body?.to?.lat), lng: Number(req.body?.to?.lng) };
    if (!validPoint(from.lat, from.lng) || !validPoint(to.lat, to.lng) || req.body?.from === undefined || req.body?.to === undefined) {
      return res.status(400).json({ message: 'Choose a start and an end point on the map.' });
    }
    res.json(await routeSafety(from, to, { night: req.body?.time === 'night' }));
  } catch (error) { next(error); }
});

app.get('/api/briefing', async (req, res, next) => {
  try { res.json(await getBriefing(req.query.location, { night: nightFlag(req) })); } catch (error) { next(error); }
});

app.post('/api/admin/refresh-roads', optionalAuth, requireAdmin, async (_req, res, next) => {
  try { res.json({ results: await refreshRoadGeometry({ force: true }) }); } catch (error) { next(error); }
});

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required.' });
    }
    if (await User.exists({ email: email.trim().toLowerCase() })) return res.status(409).json({ message: 'Email already exists.' });
    const user = await User.create({ name: name.trim(), email, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ user: publicUser(user), token: authToken(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
    res.json({ user: publicUser(user), token: authToken(user) });
  } catch (error) { next(error); }
});

app.get('/api/locations', async (_req, res, next) => {
  try { res.json(await Location.find().lean()); } catch (error) { next(error); }
});

app.get('/api/locations/zones', async (_req, res, next) => {
  try {
    const zones = await Zone.find().populate('location').lean();
    res.json(zones.filter((zone) => zone.location).map(({ _id, location, status, updatedAt, startTime, endTime }) => ({ id: _id, location: { ...location, id: location._id }, status, updatedAt, startTime, endTime })));
  } catch (error) { next(error); }
});

app.get('/api/locations/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Location not found.' });
    const location = await Location.findById(req.params.id).lean();
    if (!location) return res.status(404).json({ message: 'Location not found.' });
    const [zone, reviews] = await Promise.all([
      Zone.findOne({ location: location._id }).lean(),
      Review.find({ location: location._id }).populate('user', 'name role verified').sort({ timestamp: -1 }).lean(),
    ]);
    res.json({ location: { ...location, id: location._id }, zone, reviews });
  } catch (error) { next(error); }
});

app.post('/api/locations/:id/reviews', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Location not found.' });
    const location = await Location.findById(req.params.id);
    if (!location) return res.status(404).json({ message: 'Location not found.' });
    const content = String(req.body?.content || '').trim();
    if (!content || content.length > 2000) return res.status(400).json({ message: 'Report must be between 1 and 2000 characters.' });
    const positive = ['safe', 'police', 'well lit', 'well-lit'];
    const negative = ['robbery', 'accident', 'unsafe', 'harassment', 'poor lighting'];
    const lower = content.toLowerCase();
    const positives = positive.filter((word) => lower.includes(word));
    const negatives = negative.filter((word) => lower.includes(word));
    const score = positives.length && !negatives.length ? 3 : negatives.length && !positives.length ? -3 : lower.includes('suspicious') ? -1 : 0;
    const hour = new Date().getHours();
    const timeOfDay = hour < 17 ? 'DAY' : hour < 21 ? 'EVENING' : 'NIGHT';
    const review = await Review.create({ location: location._id, user: req.user?._id, content, keywords: [...positives, ...negatives], sentimentScore: score, timeOfDay });
    const aggregate = await Review.aggregate([{ $match: { location: location._id } }, { $group: { _id: null, average: { $avg: '$sentimentScore' } } }]);
    const average = aggregate[0]?.average ?? 0;
    const status = average > 2 ? 'GREEN' : average >= 0 ? 'ORANGE' : 'RED';
    const previous = await Zone.findOne({ location: location._id });
    const changed = !previous || previous.status !== status;
    const zone = await Zone.findOneAndUpdate({ location: location._id }, { $set: { status, updatedAt: new Date() } }, { upsert: true, new: true });
    if (changed) await ZoneHistory.create({ location: location._id, status });
    res.status(201).json({ review: { ...review.toObject(), id: review.id }, zone: { id: zone.id, status: zone.status, updatedAt: zone.updatedAt } });
  } catch (error) { next(error); }
});

app.get('/api/locations/:id/history', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Location not found.' });
    res.json(await ZoneHistory.find({ location: req.params.id }).sort({ recordedAt: 1 }).lean());
  } catch (error) { next(error); }
});

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
});

app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ message: 'That email is already registered.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: 'Some fields are invalid. Please check the form and try again.' });
  if (!error.status || error.status >= 500) console.error(error);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'An unexpected server error occurred.' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    const server = app.listen(port, () => console.log(`SafeRoute API listening on http://localhost:${port}`));
    server.on('error', (err) => console.error('Server error:', err.message));
    if (process.env.AUTO_SEED !== 'false') {
      seedDatabase().then((summary) => console.log('Demo data:', summary)).catch((error) => console.warn('Seeding skipped:', error.message));
    }
    // Replace rough road outlines with exact OpenStreetMap geometry in the background (needs internet once).
    if (process.env.AUTO_FETCH_ROADS !== 'false') {
      refreshRoadGeometry().then((results) => { const ok = results.filter((r) => r.ok).length; if (results.length) console.log(`Road geometry: ${ok}/${results.length} roads traced from OpenStreetMap`); }).catch((error) => console.warn('Road geometry fetch skipped:', error.message));
    }
  })
  .catch((error) => { console.error('Could not connect to MongoDB:', error.message); process.exit(1); });

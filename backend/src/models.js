import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, trim: true },
  role: { type: String, enum: ['ADMIN', 'VERIFIED', 'LOCAL_RESIDENT', 'STANDARD'], default: 'STANDARD' },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

const locationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  type: { type: String, enum: ['STREET', 'SHOP', 'NEIGHBORHOOD', 'ROUTE'], default: 'NEIGHBORHOOD' },
}, { timestamps: true });

const reviewSchema = new Schema({
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  keywords: [{ type: String }],
  sentimentScore: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  timeOfDay: { type: String, enum: ['DAY', 'EVENING', 'NIGHT'], default: 'DAY' },
}, { timestamps: true });

const zoneSchema = new Schema({
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true, unique: true },
  status: { type: String, enum: ['GREEN', 'ORANGE', 'RED'], default: 'ORANGE' },
  startTime: Date,
  endTime: Date,
  updatedAt: { type: Date, default: Date.now },
});

const zoneHistorySchema = new Schema({
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  status: { type: String, enum: ['GREEN', 'ORANGE', 'RED'], required: true },
  recordedAt: { type: Date, default: Date.now },
});

export const REPORT_CATEGORIES = ['road_hazard', 'accident', 'dangerous_driving', 'traffic_disruption', 'weather_hazard', 'harassment', 'poor_lighting', 'suspicious_activity', 'unsafe_area', 'other'];
export const PLACE_CATEGORIES = ['women_safe', 'police', 'hospital', 'pharmacy', 'transport', 'rest_stop', 'public_place', 'shelter'];

const communityReportSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  category: { type: String, enum: REPORT_CATEGORIES, required: true },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  locationName: { type: String, required: true, trim: true, maxlength: 180 },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  status: { type: String, enum: ['UNVERIFIED', 'VERIFIED', 'REJECTED'], default: 'UNVERIFIED' },
  source: { type: String, enum: ['community', 'demo-seed'], default: 'community' },
  confirms: { type: [String], default: [] },
  disputes: { type: [String], default: [] },
  reviewedByAdmin: { type: Boolean, default: false },
}, { timestamps: true });
communityReportSchema.index({ lat: 1, lng: 1 });

// Safe places: police, women's help desks, hospitals... Community-added places start PENDING
// and become VERIFIED once enough different people confirm them (or an admin approves).
const placeSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  category: { type: String, enum: PLACE_CATEGORIES, required: true },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  address: { type: String, trim: true, maxlength: 240, default: '' },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  hours: { type: String, trim: true, maxlength: 80, default: '' },
  open24x7: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
  source: { type: String, enum: ['community', 'demo-seed', 'admin'], default: 'community' },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  confirms: { type: [String], default: [] },
  disputes: { type: [String], default: [] },
  reviewedByAdmin: { type: Boolean, default: false },
}, { timestamps: true });
placeSchema.index({ lat: 1, lng: 1 });
placeSchema.index({ category: 1, status: 1 });

// A tracked road/highway. `paths` is a list of polylines ([lat, lng] points) drawn on the map.
// Geometry starts as a rough fallback and is replaced by exact OpenStreetMap geometry when online.
const roadSegmentSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: ['highway', 'road'], default: 'road' },
  aliases: { type: [String], default: [] },
  osm: { ref: String, name: String },
  bbox: { type: [Number], default: undefined },
  paths: { type: [[[Number]]], default: [] },
  geometrySource: { type: String, enum: ['fallback', 'osm'], default: 'fallback' },
  geometryFetchedAt: Date,
  baseScore: { type: Number, default: 0 },
  reasons: { type: [String], default: [] },
  source: { type: String, enum: ['demo-seed', 'admin'], default: 'demo-seed' },
}, { timestamps: true });

// A circular colour zone (women-safety / road / general) with a base score that live data adjusts.
const riskZoneSchema = new Schema({
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: ['women', 'road', 'general'], default: 'general' },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  radiusM: { type: Number, required: true, min: 50, max: 5000 },
  baseScore: { type: Number, default: 0 },
  reasons: { type: [String], default: [] },
  source: { type: String, enum: ['demo-seed', 'admin'], default: 'demo-seed' },
}, { timestamps: true });

// Geocoded news incidents are remembered (for 6 months) so zones/roads keep their colour between searches.
const newsIncidentSchema = new Schema({
  urlHash: { type: String, required: true, unique: true },
  title: String,
  summary: String,
  type: String,
  topic: { type: String, enum: ['road', 'women'], default: 'road' },
  placeName: String,
  lat: Number,
  lng: Number,
  accuracy: String,
  roadId: { type: Schema.Types.ObjectId, ref: 'RoadSegment' },
  source: String,
  articleUrl: String,
  publishedAt: Date,
}, { timestamps: true });
newsIncidentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 190 * 24 * 3600 });
newsIncidentSchema.index({ roadId: 1 });

export const User = model('User', userSchema);
export const Location = model('Location', locationSchema);
export const Review = model('Review', reviewSchema);
export const Zone = model('Zone', zoneSchema);
export const ZoneHistory = model('ZoneHistory', zoneHistorySchema);
export const CommunityReport = model('CommunityReport', communityReportSchema);
export const Place = model('Place', placeSchema);
export const RoadSegment = model('RoadSegment', roadSegmentSchema);
export const RiskZone = model('RiskZone', riskZoneSchema);
export const NewsIncident = model('NewsIncident', newsIncidentSchema);

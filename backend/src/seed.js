import { CommunityReport, Place, RiskZone, RoadSegment } from './models.js';
import { seedPlaces, seedReports, seedRoads, seedZones } from './seedData.js';
import { invalidateRoadCache } from './roads.js';

// Fills empty collections with the demo dataset. With { reset: true } it first removes
// previous demo-seed rows (community-added data is never touched).
export async function seedDatabase({ reset = false } = {}) {
  const summary = {};
  const plan = [
    ['places', Place, seedPlaces],
    ['roads', RoadSegment, seedRoads],
    ['zones', RiskZone, seedZones],
    ['reports', CommunityReport, seedReports],
  ];
  for (const [name, Model, build] of plan) {
    if (reset) await Model.deleteMany({ source: 'demo-seed' });
    const existing = await Model.estimatedDocumentCount();
    if (existing > 0 && !reset) { summary[name] = 'kept existing'; continue; }
    const rows = build();
    await Model.insertMany(rows);
    summary[name] = `${rows.length} added`;
  }
  invalidateRoadCache();
  return summary;
}

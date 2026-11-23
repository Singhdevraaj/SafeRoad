import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDatabase } from './seed.js';
import { refreshRoadGeometry } from './roads.js';

const args = process.argv.slice(2);
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set in backend/.env'); process.exit(1); }
await mongoose.connect(process.env.MONGODB_URI);
if (args.includes('--roads-only')) {
  console.log('Fetching exact road geometry from OpenStreetMap (takes ~20 s)…');
  console.table(await refreshRoadGeometry({ force: args.includes('--force') }));
} else {
  console.log(await seedDatabase({ reset: args.includes('--reset') }));
  if (args.includes('--roads')) console.table(await refreshRoadGeometry({ force: true }));
}
await mongoose.disconnect();

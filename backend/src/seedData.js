// DEMO DATASET for Jaipur. Edit freely, then run:  npm run seed -- --reset
//
// IMPORTANT: this is illustrative sample data, not official statistics.
//  - Coordinates are approximate (landmark/locality level). Spot-check on the map before the demo.
//  - Risk scores are sample estimates so that every colour (green/yellow/orange/red) is visible.
// Entries are tagged source:'demo-seed' and the UI labels them "Demo data".
// Real safety data comes from news, community reports and the verification votes.

export const places = [
  // ---- Women's safe spaces / help desks ----
  { name: 'Women Help Desk – Jaipur Junction', category: 'women_safe', lat: 26.9197, lng: 75.7878, address: 'Jaipur Junction railway station', phone: '1091', open24x7: true, tags: ['female staff', 'cctv', 'well lit'], notes: 'Help desk near the main concourse.' },
  { name: 'Women Help Desk – Sindhi Camp Bus Stand', category: 'women_safe', lat: 26.9226, lng: 75.7946, address: 'Sindhi Camp, Jaipur', phone: '1091', open24x7: true, tags: ['female staff', 'cctv'] },
  { name: 'Mahila Help Desk – Malviya Nagar', category: 'women_safe', lat: 26.8548, lng: 75.8243, address: 'Malviya Nagar, Jaipur', phone: '181', hours: '24 hours', open24x7: true, tags: ['female staff'] },
  { name: 'Women Help Desk – Vaishali Nagar', category: 'women_safe', lat: 26.9124, lng: 75.7289, address: 'Vaishali Nagar, Jaipur', phone: '1091', open24x7: true, tags: ['female staff', 'well lit'] },
  { name: 'Women Help Desk – Mansarovar', category: 'women_safe', lat: 26.8575, lng: 75.7580, address: 'Mansarovar, Jaipur', phone: '1091', open24x7: true, tags: ['female staff'] },
  // ---- Police ----
  { name: 'Police Station – Malviya Nagar', category: 'police', lat: 26.8530, lng: 75.8190, address: 'Malviya Nagar', phone: '112', open24x7: true, tags: ['cctv'] },
  { name: 'Police Station – Vaishali Nagar', category: 'police', lat: 26.9105, lng: 75.7300, address: 'Vaishali Nagar', phone: '112', open24x7: true },
  { name: 'Police Station – Mansarovar', category: 'police', lat: 26.8560, lng: 75.7650, address: 'Mansarovar', phone: '112', open24x7: true },
  { name: 'Police Station – Civil Lines', category: 'police', lat: 26.9150, lng: 75.7890, address: 'Civil Lines', phone: '112', open24x7: true },
  { name: 'Police Station – Gandhi Nagar', category: 'police', lat: 26.8930, lng: 75.8020, address: 'Gandhi Nagar', phone: '112', open24x7: true },
  { name: 'Police Station – Sanganer', category: 'police', lat: 26.8185, lng: 75.7975, address: 'Sanganer', phone: '112', open24x7: true },
  { name: 'Police Station – Amer', category: 'police', lat: 26.9850, lng: 75.8530, address: 'Amer', phone: '112', open24x7: true },
  // ---- Hospitals ----
  { name: 'SMS Hospital', category: 'hospital', lat: 26.9060, lng: 75.8160, address: 'Tonk Road', phone: '108', open24x7: true, tags: ['emergency', 'trauma'] },
  { name: 'Fortis Escorts Hospital', category: 'hospital', lat: 26.8517, lng: 75.8123, address: 'JLN Marg, Malviya Nagar', open24x7: true, tags: ['emergency'] },
  { name: 'Mahatma Gandhi Hospital, Sitapura', category: 'hospital', lat: 26.7790, lng: 75.8420, address: 'Sitapura', open24x7: true, tags: ['emergency'] },
  // ---- 24x7 pharmacies ----
  { name: '24×7 Medical Store – Sindhi Camp', category: 'pharmacy', lat: 26.9215, lng: 75.7960, address: 'Sindhi Camp', open24x7: true },
  { name: '24×7 Medical Store – Vaishali Nagar', category: 'pharmacy', lat: 26.9120, lng: 75.7260, address: 'Vaishali Nagar', open24x7: true },
  { name: '24×7 Medical Store – Mansarovar', category: 'pharmacy', lat: 26.8570, lng: 75.7600, address: 'Mansarovar', open24x7: true },
  // ---- Transit hubs ----
  { name: 'Jaipur Junction Railway Station', category: 'transport', lat: 26.9197, lng: 75.7878, address: 'Station Road', open24x7: true, tags: ['cctv', 'rpf'] },
  { name: 'Sindhi Camp Bus Stand', category: 'transport', lat: 26.9226, lng: 75.7946, address: 'Sindhi Camp', open24x7: true, tags: ['cctv'] },
  { name: 'Gandhi Nagar Railway Station', category: 'transport', lat: 26.8938, lng: 75.8035, address: 'Gandhi Nagar', tags: ['cctv'] },
  { name: 'Jaipur International Airport', category: 'transport', lat: 26.8242, lng: 75.8122, address: 'Sanganer', open24x7: true, tags: ['cctv', 'security guard', 'well lit'] },
  // ---- Well-lit public places ----
  { name: 'World Trade Park', category: 'public_place', lat: 26.8545, lng: 75.8060, address: 'JLN Marg, Malviya Nagar', hours: 'Till late evening', tags: ['cctv', 'security guard', 'well lit'] },
  { name: 'Central Park', category: 'public_place', lat: 26.9068, lng: 75.8085, address: 'Jaipur', hours: 'Early morning – evening', tags: ['well lit'] },
  { name: 'Jawahar Circle Garden', category: 'public_place', lat: 26.8440, lng: 75.8070, address: 'Jawahar Circle', tags: ['well lit', 'security guard'] },
  // ---- Highway rest stops ----
  { name: '24×7 Petrol Pump & Rest Stop – Sikar Road', category: 'rest_stop', lat: 26.9650, lng: 75.7690, address: 'Sikar Road', open24x7: true, tags: ['well lit', 'cctv'] },
];

// aliases = regex patterns used to link news headlines to the road. bbox = [south, west, north, east].
// `fallback` is a rough polyline drawn until exact OpenStreetMap geometry is fetched (npm run roads:fetch).
export const roads = [
  { slug: 'delhi-jaipur-highway', name: 'Delhi–Jaipur Highway (NH-48)', kind: 'highway', baseScore: 6, osm: { ref: '^NH ?48' }, bbox: [26.95, 75.70, 27.80, 76.35],
    aliases: ['delhi[\\s\\-–]+jaipur\\s+(highway|expressway|road)', 'jaipur[\\s\\-–]+delhi\\s+(highway|expressway|road)', '\\bNH[\\s\\-]?48\\b.*\\b(kotputli|shahpura|chandwaji|behror|manesar)\\b'],
    reasons: ['High-speed freight and passenger traffic', 'Frequent overtaking on fast stretches', 'Fog and low visibility in winter'],
    fallback: [[26.965, 75.80], [27.15, 75.90], [27.387, 75.965], [27.70, 76.183]] },
  { slug: 'jaipur-ajmer-highway', name: 'Jaipur–Ajmer Highway (NH-48)', kind: 'highway', baseScore: 5, osm: { ref: '^NH ?48' }, bbox: [26.50, 74.80, 26.95, 75.80],
    aliases: ['jaipur[\\s\\-–]+ajmer\\s+(highway|expressway|road)', 'ajmer[\\s\\-–]+jaipur\\s+(highway|expressway|road)', '\\bNH[\\s\\-]?48\\b.*\\b(kishangarh|dudu|bagru|mozamabad|phagi)\\b'],
    reasons: ['Heavy truck movement', 'Few lit rest points between towns', 'Frequent night-time breakdowns'],
    fallback: [[26.90, 75.75], [26.815, 75.55], [26.66, 75.20], [26.59, 74.86]] },
  { slug: 'jaipur-agra-highway', name: 'Jaipur–Agra Highway', kind: 'highway', baseScore: 4.5, osm: { ref: '^(NH ?21|NH ?11)' }, bbox: [26.85, 75.80, 27.10, 76.70],
    aliases: ['jaipur[\\s\\-–]+agra\\s+(highway|road)', 'agra[\\s\\-–]+jaipur\\s+(highway|road)', '\\bNH[\\s\\-]?(21|11)\\b.*\\b(dausa|bandikui|mahwa)\\b'],
    reasons: ['Mixed local and long-distance traffic', 'Unlit sections near towns'],
    fallback: [[26.91, 75.84], [26.915, 76.10], [26.90, 76.35], [26.894, 76.56]] },
  { slug: 'ajmer-road', name: 'Ajmer Road (Jaipur)', kind: 'road', baseScore: 4.5, osm: { name: 'Ajmer Road' }, bbox: [26.80, 75.50, 26.95, 75.80],
    aliases: ['\\bajmer road\\b'],
    reasons: ['Busy industrial traffic', 'Poor street lighting on outer stretches'],
    fallback: [[26.9125, 75.78], [26.899, 75.72], [26.865, 75.63], [26.816, 75.55]] },
  { slug: 'sikar-road', name: 'Sikar Road', kind: 'road', baseScore: 4, osm: { name: 'Sikar Road' }, bbox: [26.92, 75.55, 27.20, 75.82],
    aliases: ['\\bsikar road\\b'],
    reasons: ['Fast two-wheeler traffic', 'Isolated stretches after dark'],
    fallback: [[26.933, 75.79], [26.97, 75.77], [27.03, 75.70], [27.10, 75.63]] },
  { slug: 'tonk-road', name: 'Tonk Road', kind: 'road', baseScore: 3.5, osm: { name: 'Tonk Road' }, bbox: [26.78, 75.74, 26.93, 75.86],
    aliases: ['\\btonk road\\b'],
    reasons: ['Dense peak-hour traffic', 'Pedestrian crossings without signals'],
    fallback: [[26.8995, 75.795], [26.8745, 75.7945], [26.85, 75.7985], [26.8245, 75.806]] },
  { slug: 'amer-road', name: 'Amer Road', kind: 'road', baseScore: 2.5, osm: { name: 'Amer Road' }, bbox: [26.90, 75.80, 27.00, 75.88],
    aliases: ['\\bamer road\\b'],
    reasons: ['Tourist traffic and slow vehicles', 'Crowding during events'],
    fallback: [[26.9262, 75.829], [26.944, 75.839], [26.966, 75.847], [26.985, 75.8505]] },
  { slug: 'jln-marg', name: 'JLN Marg', kind: 'road', baseScore: 1.5, osm: { name: 'Jawaharlal Nehru Marg|JLN Marg' }, bbox: [26.82, 75.78, 26.92, 75.85],
    aliases: ['\\bJLN Marg\\b', 'jawaharlal nehru marg'],
    reasons: ['Well-lit, busy arterial road'],
    fallback: [[26.8965, 75.8075], [26.878, 75.8165], [26.86, 75.812], [26.8445, 75.8062]] },
];

export const zones = [
  { name: 'Sindhi Camp bus stand area', kind: 'women', lat: 26.9226, lng: 75.7946, radiusM: 450, baseScore: 4, reasons: ['Crowded transit hub', 'Reports of harassment after dark'] },
  { name: 'Railway Station – Station Road', kind: 'women', lat: 26.9205, lng: 75.7870, radiusM: 400, baseScore: 3, reasons: ['Late-night arrivals', 'Staffed help desk nearby'] },
  { name: 'Bais Godam – Ajmer Road junction', kind: 'road', lat: 26.9110, lng: 75.7830, radiusM: 450, baseScore: 5, reasons: ['Heavy truck movement', 'Weak lighting at night'] },
  { name: 'Tonk Road – Durgapura stretch', kind: 'road', lat: 26.8610, lng: 75.7955, radiusM: 500, baseScore: 3, reasons: ['Frequent peak-hour crashes (sample)'] },
  { name: 'Amer Road tourist stretch', kind: 'general', lat: 26.9600, lng: 75.8450, radiusM: 700, baseScore: 2.5, reasons: ['Tourist crowding and pickpocket warnings'] },
  { name: 'Jawahar Circle garden pocket', kind: 'women', lat: 26.8440, lng: 75.8070, radiusM: 350, baseScore: 2, reasons: ['Quiet after sunset'] },
  { name: 'Malviya Nagar – WTP market', kind: 'general', lat: 26.8545, lng: 75.8080, radiusM: 500, baseScore: 0.8, reasons: ['Well lit and crowded commercial area'] },
  { name: 'Vaishali Nagar – main market', kind: 'women', lat: 26.9124, lng: 75.7289, radiusM: 450, baseScore: 1, reasons: ['Busy, patrolled market area'] },
];

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
// Sample community reports (clearly marked demo) so zones/roads react visibly in the demo.
export const reports = [
  { category: 'harassment', description: 'Group loitering near the bus stand exit after 9 pm; women avoiding the side lane.', locationName: 'Sindhi Camp bus stand', lat: 26.9230, lng: 75.7950, status: 'VERIFIED', age: 6 },
  { category: 'poor_lighting', description: 'Street lights not working on the connecting lane.', locationName: 'Sindhi Camp lane', lat: 26.9218, lng: 75.7938, status: 'VERIFIED', age: 11 },
  { category: 'suspicious_activity', description: 'Unmarked vehicles circling slowly at night.', locationName: 'Sindhi Camp', lat: 26.9235, lng: 75.7960, status: 'UNVERIFIED', age: 3 },
  { category: 'accident', description: 'Truck-car collision at the junction; lane blocked for an hour.', locationName: 'Bais Godam', lat: 26.9112, lng: 75.7825, status: 'VERIFIED', age: 9 },
  { category: 'dangerous_driving', description: 'Overloaded trucks cutting across lanes.', locationName: 'Ajmer Road near Bais Godam', lat: 26.9100, lng: 75.7800, status: 'UNVERIFIED', age: 4 },
  { category: 'road_hazard', description: 'Large pothole on the service road, no signage.', locationName: 'Tonk Road, Durgapura', lat: 26.8612, lng: 75.7950, status: 'UNVERIFIED', age: 7 },
  { category: 'accident', description: 'Two-wheeler skid near the underpass during rain.', locationName: 'Tonk Road underpass', lat: 26.8600, lng: 75.7960, status: 'VERIFIED', age: 14 },
  { category: 'unsafe_area', description: 'Very quiet after 8 pm; few people and poor lighting.', locationName: 'Jawahar Circle garden edge', lat: 26.8438, lng: 75.8075, status: 'UNVERIFIED', age: 5 },
  { category: 'dangerous_driving', description: 'Speeding vehicles on the fast stretch; no median barrier.', locationName: 'Delhi-Jaipur highway near Chandwaji', lat: 27.15, lng: 75.90, status: 'UNVERIFIED', age: 8 },
  { category: 'weather_hazard', description: 'Dense fog reduced visibility to a few metres in the early morning.', locationName: 'Delhi-Jaipur highway near Shahpura', lat: 27.387, lng: 75.965, status: 'VERIFIED', age: 15 },
];

export const seedReports = () => reports.map(({ age, ...r }) => ({ ...r, source: 'demo-seed', createdAt: daysAgo(age), confirms: r.status === 'VERIFIED' ? ['seed-a', 'seed-b', 'seed-c'] : [], reviewedByAdmin: false }));
export const seedPlaces = () => places.map((p) => ({ ...p, status: 'VERIFIED', source: 'demo-seed', tags: p.tags || [], open24x7: Boolean(p.open24x7) }));
export const seedRoads = () => roads.map(({ fallback, ...r }) => ({ ...r, paths: [fallback], geometrySource: 'fallback', source: 'demo-seed' }));
export const seedZones = () => zones.map((z) => ({ ...z, source: 'demo-seed' }));

export const LEVELS = {
  RED: { label: 'High risk', color: '#ef4444', rank: 3 },
  ORANGE: { label: 'Elevated', color: '#f97316', rank: 2 },
  YELLOW: { label: 'Caution', color: '#eab308', rank: 1 },
  GREEN: { label: 'Safer', color: '#22c55e', rank: 0 },
};

export const PLACE_CATEGORIES = {
  women_safe: { label: "Women's safe space", emoji: '🛡️', color: '#ec4899' },
  police: { label: 'Police', emoji: '👮', color: '#3b82f6' },
  hospital: { label: 'Hospital', emoji: '🏥', color: '#ef4444' },
  pharmacy: { label: '24×7 pharmacy', emoji: '💊', color: '#10b981' },
  transport: { label: 'Transit hub', emoji: '🚉', color: '#8b5cf6' },
  rest_stop: { label: 'Highway rest stop', emoji: '⛽', color: '#f59e0b' },
  public_place: { label: 'Well-lit public place', emoji: '💡', color: '#06b6d4' },
  shelter: { label: 'Shelter', emoji: '🏠', color: '#14b8a6' },
};
export const HELP_CATEGORIES = ['women_safe', 'police', 'hospital', 'public_place', 'transport'];
export const PLACE_TAGS = ['cctv', 'female staff', 'well lit', 'security guard', 'emergency', '24x7 access', 'wheelchair access'];

export const REPORT_GROUPS = [
  ['Road safety', [['road_hazard', 'Road damage / highway hazard'], ['accident', 'Accident'], ['dangerous_driving', 'Dangerous driving'], ['traffic_disruption', 'Traffic disruption / road closure'], ['weather_hazard', 'Weather hazard on road']]],
  ['Personal safety', [['harassment', 'Harassment / eve-teasing'], ['poor_lighting', 'Poor street lighting'], ['suspicious_activity', 'Suspicious activity'], ['unsafe_area', 'Area feels unsafe']]],
  ['Other', [['other', 'Other safety issue']]],
];
export const REPORT_LABELS = {
  ...Object.fromEntries(REPORT_GROUPS.flatMap(([, items]) => items)),
  women_safe: "Women's safe space",
  police: 'Police station',
  hospital: 'Hospital / Clinic',
  pharmacy: '24×7 pharmacy',
  transport: 'Transit hub',
  rest_stop: 'Rest stop',
  public_place: 'Public place',
  shelter: 'Safe shelter',
};
export const WOMEN_REPORTS = ['harassment', 'poor_lighting', 'suspicious_activity', 'unsafe_area'];

export const INCIDENT_LABELS = { accident: 'Road accident', road_hazard: 'Road hazard', traffic_disruption: 'Traffic disruption', vehicle_fire: 'Vehicle fire', harassment: 'Harassment', crime: 'Crime', other: 'Incident' };

// Indian helplines (verify before printing on any handout).
export const HELPLINES = [
  { name: 'Emergency (police / fire / ambulance)', number: '112' },
  { name: 'Women helpline', number: '1091' },
  { name: 'Women helpline (domestic abuse)', number: '181' },
  { name: 'Ambulance', number: '108' },
  { name: 'NHAI highway helpline', number: '1033' },
  { name: 'Childline', number: '1098' },
];

export const haversineM = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
};
export const fmtDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
export const mapsDirections = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

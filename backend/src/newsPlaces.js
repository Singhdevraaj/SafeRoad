// Conservative fallback: only places explicitly named in source text.
const rajasthanPlaces = ['Sawai Madhopur', 'Chittorgarh', 'Hanumangarh', 'Sri Ganganagar', 'Jhunjhunu', 'Dungarpur', 'Banswara', 'Jaisalmer', 'Bharatpur', 'Dholpur', 'Pratapgarh', 'Rajsamand', 'Bhilwara', 'Jhalawar', 'Kishangarh', 'Kotputli', 'Behror', 'Chirawa', 'Phalodi', 'Balotra', 'Barmer', 'Bikaner', 'Jodhpur', 'Udaipur', 'Jaipur', 'Ajmer', 'Alwar', 'Sikar', 'Churu', 'Nagaur', 'Dausa', 'Tonk', 'Bundi', 'Baran', 'Kota', 'Pali', 'Sirohi', 'Jalore'];

const jaipurLocalities = ['Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'Jhotwara', 'Sanganer', 'Sitapura', 'Raja Park', 'C-Scheme', 'Bani Park', 'Sindhi Camp', 'Civil Lines', 'Gandhi Nagar', 'Jawahar Circle', 'Durgapura', 'Bais Godam', 'Chandpole', 'Vidhyadhar Nagar', 'Pratap Nagar', 'Jagatpura', 'Murlipura', 'Sodala', 'Gopalpura', 'Shastri Nagar', 'Nirman Nagar', 'Ajmeri Gate', 'Tonk Phatak', 'Amer', 'Kukas', 'Bagru'];

export function sourcePlace(article) {
  // Remove the publisher suffix: a publisher's city is not incident evidence.
  const headline = article.title.replace(/\s+-\s+[^-]+$/, '');
  const road = headline.match(/\b([A-Za-z]+[-–][A-Za-z]+)\s+(highway|expressway|road)\b/i);
  const matches = rajasthanPlaces.filter((place) => new RegExp(`\\b${place}\\b`, 'i').test(headline));
  if (road && matches.length) return { name: `${road[1]} ${road[2]}`, queryArea: 'Rajasthan, India', precision: 'road corridor (approximate)' };
  const local = jaipurLocalities.filter((place) => new RegExp(`\\b${place}\\b`, 'i').test(headline));
  if (!road && local.length === 1) return { name: local[0], queryArea: 'Jaipur, Rajasthan, India', precision: 'neighborhood-level' };
  // Multiple cities in a headline can denote a route or an unrelated place; do not guess.
  if (matches.length === 1) return { name: matches[0], queryArea: 'Rajasthan, India', precision: 'city/area only — exact incident site unknown' };
  return null;
}

export function isIncidentHeadline(title) {
  return !/world day|remembrance|awareness|road safety week|annual report|statistics|accident victims.*tribute/i.test(title);
}

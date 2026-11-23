// Links a news headline/snippet to one of our tracked roads using each road's alias patterns.
export function matchRoad(text, roads = []) {
  const haystack = String(text || '');
  for (const road of roads) {
    for (const alias of road.aliases || []) {
      try { if (new RegExp(alias, 'i').test(haystack)) return road; } catch { /* ignore a malformed alias */ }
    }
  }
  return null;
}

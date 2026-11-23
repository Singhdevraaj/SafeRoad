import { MapPin, Plus } from 'lucide-react';
import { PLACE_CATEGORIES, fmtDistance, haversineM } from '../../constants';

export default function PlacesTab({ places, filter, onFilter, center, selectedPlaceId, onSelect, onAdd }) {
  const counts = places.reduce((acc, p) => ({ ...acc, [p.category]: (acc[p.category] || 0) + 1 }), {});
  const shown = places.filter((p) => !filter.length || filter.includes(p.category))
    .map((p) => ({ ...p, distance: center ? haversineM(center, [p.lat, p.lng]) : null }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  const toggle = (id) => onFilter(filter.includes(id) ? filter.filter((f) => f !== id) : [...filter, id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-xs leading-5 text-slate-400">Pick categories to filter. Women-first: start with <button type="button" onClick={() => onFilter(['women_safe'])} className="font-semibold text-pink-300 underline">women’s safe spaces</button>.</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onFilter([])} className={`rounded-full border px-2.5 py-1 text-xs ${filter.length === 0 ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-white/10 text-slate-400'}`}>All ({places.length})</button>
        {Object.entries(PLACE_CATEGORIES).map(([id, c]) => (
          <button key={id} type="button" onClick={() => toggle(id)} className={`rounded-full border px-2.5 py-1 text-xs ${filter.includes(id) ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>{c.emoji} {c.label} ({counts[id] || 0})</button>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-bold text-white shadow-lg"><Plus className="h-4 w-4" />Add a safe place</button>
      <ul className="space-y-1.5">
        {shown.length === 0 && <li className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">No places in this category yet. Be the first to add one.</li>}
        {shown.slice(0, 80).map((p) => (
          <li key={p.id}><button type="button" onClick={() => onSelect(p)} className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left ${selectedPlaceId === p.id ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/5 bg-black/20 hover:border-white/15'}`}>
            <span className="mt-0.5 text-xl">{PLACE_CATEGORIES[p.category]?.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-100">{p.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                <span>{p.status === 'VERIFIED' ? '✔ Verified' : '⏳ Awaiting confirmation'}</span>
                {p.open24x7 && <span>24×7</span>}
                {p.distance !== null && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{fmtDistance(p.distance)}</span>}
              </span>
            </span>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

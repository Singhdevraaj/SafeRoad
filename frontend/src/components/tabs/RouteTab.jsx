import { LoaderCircle, Navigation, X } from 'lucide-react';
import { LEVELS, PLACE_CATEGORIES } from '../../constants';

const pointLabel = (p) => (p ? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` : 'Not set');

function Ring({ score, level }) {
  return <div style={{ borderColor: LEVELS[level].color }} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-4 text-white"><span className="text-lg font-extrabold leading-none">{score}</span><span className="text-[8px] uppercase text-slate-400">safety</span></div>;
}

export default function RouteTab({ route, pickMode, onPick, onClear, onSelect, night }) {
  const { from, to, result, loading, error, selected } = route;
  const active = selected ?? result?.recommendedIndex ?? 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-xs leading-5 text-slate-400">Pick a start and end on the map. We fetch real driving routes and score each one against risky roads, colour zones and nearby help — {night ? 'using the 🌙 night view' : 'switch on 🌙 Night view for after-dark scoring'}.</p>
      <div className="grid grid-cols-2 gap-2">
        {[['routeFrom', 'A · Start', from], ['routeTo', 'B · End', to]].map(([mode, label, point]) => (
          <button key={mode} type="button" onClick={() => onPick(mode)} className={`rounded-xl border p-2.5 text-left ${pickMode === mode ? 'border-indigo-400 bg-indigo-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}>
            <span className="block text-xs font-bold text-white">{label}</span>
            <span className="block truncate text-[11px] text-slate-400">{pickMode === mode ? 'Click the map…' : pointLabel(point)}</span>
          </button>
        ))}
      </div>
      {(from || to) && <button type="button" onClick={onClear} className="flex items-center justify-center gap-1.5 self-start rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"><X className="h-3.5 w-3.5" />Clear route</button>}
      {loading && <div className="flex items-center gap-2 py-4 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Scoring routes…</div>}
      {error && <div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</div>}
      {result && (
        <>
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 text-xs leading-5 text-sky-100"><Navigation className="mr-1 inline h-3.5 w-3.5" />{result.advice}</div>
          <ul className="space-y-2">
            {result.routes.map((r) => (
              <li key={r.index}><button type="button" onClick={() => onSelect(r.index)} className={`w-full rounded-xl border p-3 text-left ${active === r.index ? 'border-sky-400/50 bg-sky-500/10' : 'border-white/5 bg-black/20 hover:border-white/15'}`}>
                <span className="flex items-center gap-3">
                  <Ring score={r.safetyScore} level={r.level} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">{r.label}{r.index === result.recommendedIndex && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">Recommended</span>}</span>
                    <span className="block text-xs text-slate-400">{r.distanceKm} km · {r.durationMin} min</span>
                    <span className="block text-[11px] text-slate-500">{Object.keys(r.supportPlaces).length ? `Help nearby: ${Object.entries(r.supportPlaces).map(([c, n]) => `${PLACE_CATEGORIES[c]?.emoji}${n}`).join(' ')}` : 'No help points within 400 m'}</span>
                  </span>
                </span>
                {r.hotspots.length > 0 && <ul className="mt-2 space-y-0.5 border-t border-white/5 pt-2">{r.hotspots.slice(0, 4).map((h) => <li key={`${h.type}-${h.id}`} className="flex items-center gap-1.5 text-[11px] text-slate-300"><span style={{ background: LEVELS[h.level].color }} className="h-2 w-2 shrink-0 rounded-full" /><span className="truncate">{h.name}</span><span className="ml-auto shrink-0 text-slate-500">{(h.meters / 1000).toFixed(1)} km</span></li>)}</ul>}
              </button></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

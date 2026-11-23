import { useState } from 'react';
import { MapPin, MessageCircle, Phone, Share2, X } from 'lucide-react';
import { HELP_CATEGORIES, HELPLINES, PLACE_CATEGORIES, fmtDistance, haversineM, mapsDirections } from '../constants';

export default function SosPanel({ isOpen, onClose, places, userPos, onLocate }) {
  const [message, setMessage] = useState('');
  if (!isOpen) return null;

  const nearest = userPos
    ? places.filter((p) => HELP_CATEGORIES.includes(p.category) && p.status !== 'REJECTED')
      .map((p) => ({ ...p, distance: haversineM([userPos.lat, userPos.lng], [p.lat, p.lng]) }))
      .sort((a, b) => a.distance - b.distance).slice(0, 4)
    : [];

  const shareText = userPos ? `I need help / please track me. My live location: https://www.google.com/maps?q=${userPos.lat},${userPos.lng}` : '';
  const share = async () => {
    if (!userPos) { setMessage('Tap “Find my location” first.'); return; }
    if (navigator.share) { try { await navigator.share({ title: 'My location', text: shareText }); return; } catch { /* cancelled */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Emergency help" className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-red-500/30 bg-[#0f172a] shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 bg-red-950/40 p-4">
          <h2 className="text-lg font-bold text-red-200">Emergency help</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-4 p-4">
          <a href="tel:112" className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-4 text-lg font-extrabold text-white shadow-lg hover:bg-red-500"><Phone className="h-5 w-5" />Call 112 now</a>
          <div className="grid grid-cols-2 gap-2">
            {HELPLINES.slice(1).map((h) => <a key={h.number} href={`tel:${h.number}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs text-slate-300 hover:bg-white/[0.07]"><span className="block text-base font-bold text-white">{h.number}</span>{h.name}</a>)}
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex gap-2">
              <button type="button" onClick={onLocate} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400"><MapPin className="h-4 w-4" />{userPos ? 'Update location' : 'Find my location'}</button>
              <button type="button" onClick={share} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500">{navigator.share ? <Share2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}Share location</button>
            </div>
            {message && <p className="text-xs text-amber-300">{message}</p>}
            {userPos && <p className="text-[11px] text-slate-500">Location found (±{Math.round(userPos.accuracy || 0)} m). Sharing opens your messaging app; nothing is sent automatically.</p>}
          </div>
          {userPos && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Nearest help</h3>
              {nearest.length === 0 ? <p className="text-sm text-slate-500">No help points loaded nearby.</p> : (
                <ul className="space-y-1.5">
                  {nearest.map((p) => (
                    <li key={p.id}><a href={mapsDirections(p.lat, p.lng)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-2 text-sm text-slate-200 hover:bg-white/5">
                      <span className="text-lg">{PLACE_CATEGORIES[p.category]?.emoji}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{fmtDistance(p.distance)}</span>
                    </a></li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="text-[11px] leading-4 text-slate-500">Helpline numbers are for India. In immediate danger, call 112 first.</p>
        </div>
      </section>
    </div>
  );
}

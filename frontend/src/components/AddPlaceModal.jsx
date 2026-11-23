import { useEffect, useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { PLACE_CATEGORIES, PLACE_TAGS } from '../constants';

const inputClass = 'w-full rounded-xl border border-slate-700 bg-[#050b14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400';

export default function AddPlaceModal({ isOpen, onClose, onSubmit, location, onChooseLocation }) {
  const [form, setForm] = useState({ category: 'women_safe', name: '', address: '', phone: '', hours: '', open24x7: false, notes: '', tags: [] });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (isOpen) setError(''); }, [isOpen]);
  if (!isOpen) return null;

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTag = (tag) => set('tags', form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!location) { setError('Pin the place on the map first.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ ...form, lat: location.lat, lng: location.lng });
      setForm({ category: 'women_safe', name: '', address: '', phone: '', hours: '', open24x7: false, notes: '', tags: [] });
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Could not add this place.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="place-title" className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 p-5">
          <h2 id="place-title" className="flex items-center gap-2 text-lg font-bold text-white"><Plus className="h-5 w-5 text-emerald-400" />Add a safe place</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-3.5 p-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/5 p-3 text-xs text-slate-300">
            <span><strong className="block text-indigo-200">Location</strong>{location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Not chosen yet'}</span>
            <button type="button" onClick={onChooseLocation} className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-500 px-3 py-2 font-semibold text-white hover:bg-indigo-400"><MapPin className="h-3.5 w-3.5" />{location ? 'Change' : 'Pick on map'}</button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(PLACE_CATEGORIES).map(([id, c]) => (
              <button key={id} type="button" onClick={() => set('category', id)} title={c.label} className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[10px] leading-tight ${form.category === id ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                <span className="text-lg">{c.emoji}</span><span className="text-center">{c.label}</span>
              </button>
            ))}
          </div>

          <input required minLength={2} maxLength={140} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Place name, e.g. Women Help Desk – Sector 5" className={inputClass} />
          <input maxLength={240} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Address or landmark (optional)" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input maxLength={30} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone (optional)" className={inputClass} />
            <input maxLength={80} value={form.hours} onChange={(e) => set('hours', e.target.value)} disabled={form.open24x7} placeholder="Hours, e.g. 9am–9pm" className={`${inputClass} disabled:opacity-40`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.open24x7} onChange={(e) => set('open24x7', e.target.checked)} className="h-4 w-4 accent-indigo-500" />Open 24×7</label>
          <div className="flex flex-wrap gap-1.5">
            {PLACE_TAGS.map((tag) => <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full border px-2.5 py-1 text-[11px] ${form.tags.includes(tag) ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>{tag}</button>)}
          </div>
          <textarea maxLength={500} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything helpful to know? (optional)" className={`${inputClass} resize-y`} />
          <p className="text-xs leading-5 text-slate-500">New places show as “awaiting confirmation” until 3 different people confirm them. Only add places you have seen yourself.</p>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={submitting || !location} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />{submitting ? 'Adding…' : 'Add to map'}</button>
        </form>
      </section>
    </div>
  );
}

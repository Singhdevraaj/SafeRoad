import { useEffect, useState } from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';
import { REPORT_GROUPS } from '../constants';

export default function ReportModal({ isOpen, onClose, onSubmit, location }) {
  const [category, setCategory] = useState('road_hazard');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLocationName(location?.name || '');
    setError('');
  }, [isOpen, location]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!location) { setError('Choose the exact point on the map first.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        lat: location.lat,
        lng: location.lng,
        category,
        locationName: locationName.trim(),
        description: description.trim(),
      });
      setDescription('');
      setCategory('road_hazard');
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="report-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 p-5">
          <h2 id="report-title" className="flex items-center gap-2 text-lg font-bold text-white"><AlertTriangle className="h-5 w-5 text-orange-400" />Report a safety issue</h2>
          <button type="button" aria-label="Close report form" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/5 p-3 text-xs leading-5 text-slate-300">
            <strong className="block text-indigo-200">Pinned map point</strong>
            {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Choose a point on the map before submitting.'}
          </div>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Problem type</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-[#050b14] px-3 py-3 text-white outline-none focus:border-indigo-400">
              {REPORT_GROUPS.map(([group, items]) => <optgroup key={group} label={group}>{items.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}
            </select>
          </label>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Road, highway, or place name <span className="text-slate-500">(optional)</span></span>
            <input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={180} placeholder="e.g. NH 48 near Ajmer Road" className="w-full rounded-xl border border-slate-700 bg-[#050b14] px-3 py-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
          </label>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>What happened?</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={5} maxLength={2000} required rows={4} placeholder="Describe the hazard or what you saw. Do not include names or personal details." className="w-full resize-y rounded-xl border border-slate-700 bg-[#050b14] px-3 py-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
          </label>

          <p className="text-xs leading-5 text-slate-500">Reports start as unverified and turn verified once other people confirm them. Do not include names or identifying details about other people.</p>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={submitting || !location} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-bold text-white shadow-lg transition hover:from-indigo-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" />{submitting ? 'Submitting…' : 'Submit community report'}
          </button>
        </form>
      </section>
    </div>
  );
}

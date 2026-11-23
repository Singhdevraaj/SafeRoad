import { AlertTriangle, Clock3, ExternalLink, LoaderCircle, MapPin, Search } from 'lucide-react';
import { INCIDENT_LABELS, REPORT_LABELS, WOMEN_REPORTS } from '../../constants';

const StatusPill = ({ status }) => (
  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{status === 'VERIFIED' ? '✔ Verified' : 'Unverified'}</span>
);

export default function AlertsTab({
  locationQuery, onLocationChange, onSearch, topic, onTopic, loading, error, ai, providers, incidents, reports,
  selectedIncident, selectedReport, onSelectIncident, onSelectReport, onReportClick, onChooseLocation, isPicking, user, onVote, onAdminStatus,
}) {
  const sourceList = providers ? Object.entries(providers).filter(([, v]) => typeof v === 'number' && v > 0).map(([k, v]) => `${k === 'google' ? 'Google News' : k === 'gnews' ? 'GNews' : 'NewsData'} ${v}`).join(' · ') : '';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 text-xs font-semibold">
        {[['road', '🚗 Road safety'], ['women', "🛡️ Women's safety"]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => onTopic(id)} className={`rounded-lg py-2 ${topic === id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="space-y-2">
        <label htmlFor="incident-area" className="text-xs font-semibold uppercase tracking-widest text-slate-400">News near</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input id="incident-area" value={locationQuery} onChange={(e) => onLocationChange(e.target.value)} maxLength={100} placeholder="City or neighborhood" className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400" />
          </div>
          <button type="submit" disabled={loading || locationQuery.trim().length < 2} className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="hidden sm:inline">Search</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500">{sourceList || 'Google News'} · summaries cached so AI quota is never wasted</p>
      </form>

      {error && <div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</div>}
      {ai?.note && <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[11px] text-slate-400">ℹ️ {ai.note}</div>}

      {selectedIncident && (
        <section className="shrink-0 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.08] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">News summary</span>
            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-300">{INCIDENT_LABELS[selectedIncident.type]}</span>
          </div>
          {selectedIncident.summarySource === 'source_excerpt' && <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300">News excerpt · AI summary not used</p>}
          <h2 className="text-sm font-semibold leading-5 text-white">{selectedIncident.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{selectedIncident.summary}</p>
          {selectedIncident.roadName && <p className="mt-2 text-xs font-semibold text-orange-300">🛣️ Linked to {selectedIncident.roadName}</p>}
          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />{selectedIncident.location ? `${selectedIncident.location.accuracy}: ${selectedIncident.location.address}` : 'No exact place in the source.'}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{selectedIncident.publishedAt ? new Date(selectedIncident.publishedAt).toLocaleString() : 'Recent report'}</p>
          <a href={selectedIncident.articleUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Read article at {selectedIncident.source}<ExternalLink className="h-3.5 w-3.5" /></a>
        </section>
      )}

      {selectedReport && (
        <section className="shrink-0 rounded-2xl border border-orange-400/20 bg-orange-500/[0.07] p-4">
          <div className="mb-2 flex items-center justify-between gap-2"><StatusPill status={selectedReport.status} /><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-300">{REPORT_LABELS[selectedReport.category]}</span></div>
          <h2 className="text-sm font-semibold text-white">{selectedReport.locationName}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{selectedReport.description}</p>
          <p className="mt-2 text-xs text-slate-500">👍 {selectedReport.confirms} · 👎 {selectedReport.disputes}{selectedReport.source === 'demo-seed' ? ' · Demo data' : ''}</p>
          {selectedReport.source !== 'demo-seed' && (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onVote('reports', selectedReport.id, 'confirm')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">Confirm</button>
              <button type="button" onClick={() => onVote('reports', selectedReport.id, 'dispute')} className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-500">Not accurate</button>
            </div>
          )}
          {user?.role === 'ADMIN' && <div className="mt-2 flex gap-2"><button type="button" onClick={() => onAdminStatus('reports', selectedReport.id, 'VERIFIED')} className="rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-300">Admin: verify</button><button type="button" onClick={() => onAdminStatus('reports', selectedReport.id, 'REJECTED')} className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-300">Reject</button></div>}
        </section>
      )}

      <section className="flex min-h-[10rem] shrink-0 flex-col">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Recent news</h2><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{incidents.length}</span></div>
        {loading && incidents.length === 0 ? <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Finding recent reports…</div>
          : incidents.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">Nothing found for this area. Try a nearby city.</div>
            : <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">{incidents.map((incident) => (
              <li key={incident.id}><button type="button" onClick={() => onSelectIncident(incident)} className={`w-full rounded-xl border p-3 text-left transition ${selectedIncident?.id === incident.id ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/5 bg-black/20 hover:border-white/15'}`}>
                <span className="line-clamp-2 block text-sm font-medium leading-5 text-slate-100">{incident.title}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{incident.source}{incident.roadName ? ` · 🛣️ ${incident.roadName}` : incident.location?.name ? ` · ${incident.location.name}` : ''}</span>
              </button></li>))}</ul>}
      </section>

      <details open className="shrink-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-300"><span>Community reports</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{reports.length}</span></summary>
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
          {reports.slice(0, 12).map((r) => (
            <li key={r.id}><button type="button" onClick={() => onSelectReport(r)} className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5">
              <span className={WOMEN_REPORTS.includes(r.category) ? 'text-pink-300' : 'text-orange-300'}>{REPORT_LABELS[r.category]}</span> · {r.locationName} {r.status === 'VERIFIED' && '✔'}
            </button></li>))}
        </ul>
      </details>

      <div className="shrink-0 border-t border-white/5 pt-3">
        <button type="button" onClick={onReportClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500/90 to-orange-500/90 px-4 py-3 text-sm font-bold text-white shadow-lg hover:from-red-500 hover:to-orange-500"><AlertTriangle className="h-4 w-4" />Report a safety issue</button>
        <button type="button" onClick={onChooseLocation} className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${isPicking ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}><MapPin className="h-4 w-4" />{isPicking ? 'Click a point on the map…' : 'Choose exact point on map'}</button>
      </div>
    </div>
  );
}

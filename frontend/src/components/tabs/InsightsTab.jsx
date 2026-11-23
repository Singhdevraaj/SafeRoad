import { LoaderCircle, Search, Sparkles } from 'lucide-react';
import { LEVELS } from '../../constants';

const order = ['RED', 'ORANGE', 'YELLOW', 'GREEN'];

function Bars({ title, items }) {
  const counts = order.map((level) => [level, items.filter((i) => i.level === level).length]);
  const max = Math.max(1, ...counts.map(([, n]) => n));
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h3>
      <ul className="space-y-1.5">{counts.map(([level, n]) => (
        <li key={level} className="flex items-center gap-2 text-xs text-slate-300"><span className="w-16 shrink-0">{LEVELS[level].label}</span><span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5"><span style={{ width: `${(n / max) * 100}%`, background: LEVELS[level].color }} className="block h-full rounded-full transition-all" /></span><span className="w-4 text-right">{n}</span></li>
      ))}</ul>
    </div>
  );
}

export default function InsightsTab({ roads, zones, onFocusItem, briefing, onBriefing, check, pickMode, onCheck, health }) {
  const top = [...roads.map((r) => ({ ...r, type: 'road' })), ...zones.map((z) => ({ ...z, type: 'zone' }))].sort((a, b) => b.score - a.score).slice(0, 6);
  const usage = health?.ai?.usage;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <section className="rounded-xl border border-violet-400/20 bg-violet-500/[0.07] p-3">
        <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-violet-200"><Sparkles className="h-3.5 w-3.5" />Safety briefing</h3>
          <button type="button" onClick={onBriefing} disabled={briefing.loading} className="rounded-lg bg-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-400 disabled:opacity-60">{briefing.loading ? 'Working…' : briefing.data ? 'Refresh' : 'Generate'}</button></div>
        {briefing.error && <p className="text-xs text-amber-200">{briefing.error}</p>}
        {briefing.data ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">{briefing.data.headline}</p>
            <p className="text-xs leading-5 text-slate-300">{briefing.data.summary}</p>
            <ul className="space-y-1">{briefing.data.tips.map((t) => <li key={t} className="text-xs leading-5 text-slate-200">• {t}</li>)}</ul>
            <p className="text-[10px] text-slate-500">{briefing.data.source === 'gemini' ? '✨ Written by Gemini (cached for 6 h)' : 'Built-in summary'}{briefing.data.note ? ` · ${briefing.data.note}` : ''}</p>
          </div>
        ) : <p className="text-xs text-slate-400">One tap for a plain-language summary of today’s risks. Uses at most one AI call per 6 hours.</p>}
      </section>

      <section className="rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">How safe is this spot?</h3>
        <button type="button" onClick={onCheck} className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold ${pickMode === 'check' ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}>{check.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{pickMode === 'check' ? 'Click a point on the map…' : 'Check any point on the map'}</button>
        {check.error && <p className="mt-2 text-xs text-amber-200">{check.error}</p>}
        {check.result && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-3"><div style={{ borderColor: LEVELS[check.result.level].color }} className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 text-white"><span className="text-lg font-extrabold leading-none">{check.result.safety}</span><span className="text-[8px] uppercase text-slate-400">safety</span></div>
              <div><p className="text-sm font-semibold text-white">{LEVELS[check.result.level].label}{check.result.night ? ' · night' : ''}</p>{[...check.result.zones, ...check.result.roads].slice(0, 3).map((x) => <p key={x.id} className="text-[11px] text-slate-400">{x.name}</p>)}</div></div>
            <ul className="space-y-1">{check.result.tips.map((t) => <li key={t} className="text-xs leading-5 text-slate-300">• {t}</li>)}</ul>
          </div>
        )}
      </section>

      <Bars title="Roads & highways" items={roads} />
      <Bars title="Colour zones" items={zones} />

      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Highest risk right now</h3>
        <ul className="space-y-1">{top.map((x) => (
          <li key={`${x.type}-${x.id}`}><button type="button" onClick={() => onFocusItem(x)} className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-2 text-left text-xs text-slate-200 hover:bg-white/5"><span style={{ background: LEVELS[x.level].color }} className="h-2.5 w-2.5 shrink-0 rounded-full" /><span className="min-w-0 flex-1 truncate">{x.name}</span><span className="shrink-0 text-slate-500">{x.score}</span></button></li>
        ))}</ul>
      </section>

      {usage && (
        <section className="rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">API budget today</h3>
          <ul className="space-y-1.5 text-[11px] text-slate-400">{Object.entries(usage).map(([name, u]) => (
            <li key={name} className="flex items-center gap-2"><span className="w-16 capitalize">{name}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5"><span style={{ width: `${Math.min(100, (u.used / Math.max(1, u.limit)) * 100)}%` }} className="block h-full rounded-full bg-emerald-400" /></span><span className="w-12 text-right">{u.used}/{u.limit}</span></li>
          ))}</ul>
          <p className="mt-2 text-[10px] text-slate-500">Hard daily caps keep free-tier keys from running out. Gemini: {health.ai.gemini ? 'connected' : 'no key'} · GNews: {health.news.gnews ? 'on' : 'off'} · NewsData: {health.news.newsdata ? 'on' : 'off'}.</p>
        </section>
      )}
    </div>
  );
}

import { Compass, LogOut, MapPinned, Newspaper, Shield, User } from 'lucide-react';
import { useAuth } from '../context/useAuth';

const TABS = [['alerts', 'Alerts', Newspaper], ['places', 'Safe places', MapPinned], ['route', 'Route', Compass], ['insights', 'Insights', Shield]];

// Layout shell: header + tab bar + whichever tab is active (passed as children).
export default function Sidebar({ tab, onTab, children }) {
  const { user, logout } = useAuth();
  return (
    <aside className="glass-panel absolute inset-y-2 left-2 z-[600] flex h-[calc(100%-1rem)] w-[min(24rem,calc(100vw-1rem))] shrink-0 flex-col rounded-2xl border border-white/10 shadow-[10px_0_30px_rgba(0,0,0,0.4)] lg:relative lg:inset-auto lg:z-20 lg:h-full lg:w-96 lg:rounded-none lg:border-0 lg:border-r">
      <header className="flex items-center gap-3 border-b border-white/5 bg-white/[0.02] p-4">
        <div className="shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 shadow-lg ring-1 ring-white/10"><Shield className="h-6 w-6 text-white" /></div>
        <div className="min-w-0 flex-1"><h1 className="truncate bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-xl font-bold tracking-tight text-transparent">SafeRoute</h1><p className="truncate text-[11px] text-slate-500">Community safety map</p></div>
        {user && <div title={`${user.name}${user.role === 'ADMIN' ? ' (admin)' : ''}`} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/15 px-2.5 text-xs text-indigo-200"><User className="h-4 w-4" /><span className="hidden max-w-16 truncate sm:inline">{user.name}</span></div>}
        {user && <button type="button" aria-label="Sign out" title="Sign out" onClick={logout} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /></button>}
      </header>
      <nav className="grid grid-cols-4 border-b border-white/5 text-[11px] font-semibold" role="tablist">
        {TABS.map(([id, label, icon]) => {
          const TabIcon = icon;
          return (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)} className={`flex flex-col items-center gap-1 py-2.5 ${tab === id ? 'border-b-2 border-indigo-400 text-white' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-300'}`}><TabIcon className="h-4 w-4" />{label}</button>
          );
        })}
      </nav>
      {children}
    </aside>
  );
}

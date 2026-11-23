import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, LocateFixed, Moon, PanelLeft, RefreshCw, Sun, X } from 'lucide-react';
import MapComponent from './components/MapComponent';
import ReportModal from './components/ReportModal';
import AddPlaceModal from './components/AddPlaceModal';
import SosPanel from './components/SosPanel';
import Sidebar from './components/Sidebar';
import AlertsTab from './components/tabs/AlertsTab';
import PlacesTab from './components/tabs/PlacesTab';
import RouteTab from './components/tabs/RouteTab';
import InsightsTab from './components/tabs/InsightsTab';
import { apiRequest } from './api';
import { LEVELS } from './constants';
import { useAuth } from './context/useAuth';

const boundsOf = (paths) => {
  const pts = paths.flat();
  if (!pts.length) return null;
  const lats = pts.map((p) => p[0]); const lngs = pts.map((p) => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
};
const isDark = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };
const PICK_HELP = {
  report: 'Click the exact spot to report', place: 'Click where the safe place is', check: 'Click any point to check its safety',
  routeFrom: 'Click the START point (A)', routeTo: 'Click the END point (B)',
};
const LAYER_LABELS = { roads: 'Roads & highways', zones: 'Colour zones', places: 'Safe places', news: 'News pins', reports: 'Community reports' };

export default function App() {
  const { token, user } = useAuth();
  const [locationQuery, setLocationQuery] = useState('Jaipur, India');
  const [topic, setTopic] = useState('road');
  const [incidents, setIncidents] = useState([]);
  const [reports, setReports] = useState([]);
  const [places, setPlaces] = useState([]);
  const [roads, setRoads] = useState([]);
  const [zones, setZones] = useState([]);
  const [newsMeta, setNewsMeta] = useState({ ai: null, providers: null });
  const [health, setHealth] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [night, setNight] = useState(isDark);
  const [layers, setLayers] = useState({ roads: true, zones: true, places: true, news: true, reports: true });
  const [placeFilter, setPlaceFilter] = useState([]);
  const [tab, setTab] = useState('alerts');
  const [pickMode, setPickMode] = useState(null);
  const [picked, setPicked] = useState(null);
  const [reportLocation, setReportLocation] = useState(null);
  const [placeLocation, setPlaceLocation] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [route, setRoute] = useState({ from: null, to: null, result: null, loading: false, error: '', selected: null });
  const [check, setCheck] = useState({ loading: false, error: '', result: null });
  const [briefing, setBriefing] = useState({ loading: false, error: '', data: null });
  const [userPos, setUserPos] = useState(null);
  const [areaCenter, setAreaCenter] = useState(null);
  const [focus, setFocus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const focusCounter = useRef(0);
  const noticeTimer = useRef(null);

  const focusOn = useCallback((target) => { focusCounter.current += 1; setFocus({ ...target, key: focusCounter.current }); }, []);
  const notify = useCallback((message, kind = 'info') => {
    setNotice({ message, kind });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  }, []);

  const loadLayers = useCallback(async (isNight) => {
    try {
      const q = isNight ? '?time=night' : '';
      const [r, z] = await Promise.all([apiRequest(`/roads${q}`), apiRequest(`/zones${q}`)]);
      setRoads(r.roads || []); setZones(z.zones || []);
    } catch (e) { notify(`Could not load risk layers: ${e.message}`, 'error'); }
  }, [notify]);
  const loadPlaces = useCallback(async () => {
    try { setPlaces((await apiRequest('/places?limit=1000')).places || []); } catch (e) { notify(`Could not load safe places: ${e.message}`, 'error'); }
  }, [notify]);
  const loadHealth = useCallback(() => { apiRequest('/health').then(setHealth).catch(() => {}); }, []);

  const searchIncidents = useCallback(async (area, { refresh = false, topicOverride } = {}) => {
    const query = area.trim();
    if (query.length < 2) return;
    setLoading(true); setError('');
    try {
      const result = await apiRequest(`/incidents?location=${encodeURIComponent(query)}&refresh=${refresh}&topic=${topicOverride}`);
      setIncidents(result.incidents || []);
      setNewsMeta({ ai: result.ai, providers: result.providers });
      setLocationQuery(result.area || query);
      setSelectedIncident(null); setSelectedReport(null);
      if (result.areaCenter) { setAreaCenter([result.areaCenter.lat, result.areaCenter.lng]); focusOn({ center: [result.areaCenter.lat, result.areaCenter.lng], zoom: 12 }); }
      try {
        const q = result.areaCenter ? `&lat=${result.areaCenter.lat}&lng=${result.areaCenter.lng}&radiusKm=250` : '';
        setReports((await apiRequest(`/reports?limit=1000${q}`)).reports || []);
      } catch { setReports([]); }
    } catch (e) { setError(e.message || 'Could not load recent incidents.'); setIncidents([]); }
    finally { setLoading(false); loadHealth(); }
  }, [focusOn, loadHealth]);

  useEffect(() => { searchIncidents('Jaipur, India', { topicOverride: 'road' }); loadPlaces(); loadHealth(); }, [searchIncidents, loadPlaces, loadHealth]);
  useEffect(() => { loadLayers(night); }, [night, loadLayers]);

  const startPick = (mode) => { setPickMode(mode); if (window.innerWidth < 1024) setSidebarOpen(false); };
  const cancelPick = () => { setPickMode(null); setSidebarOpen(true); };

  const runRoute = useCallback(async (from, to, isNight) => {
    setRoute((r) => ({ ...r, loading: true, error: '', result: null }));
    try {
      const result = await apiRequest('/route/safety', { method: 'POST', body: { from, to, time: isNight ? 'night' : 'day' } });
      setRoute((r) => ({ ...r, loading: false, result, selected: result.recommendedIndex }));
      const b = boundsOf(result.routes.map((x) => x.path));
      if (b) focusOn({ bounds: b, maxZoom: 14 });
    } catch (e) { setRoute((r) => ({ ...r, loading: false, error: e.message })); }
  }, [focusOn]);
  useEffect(() => { if (route.from && route.to) runRoute(route.from, route.to, night); /* re-score when day/night changes */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night]);

  const runCheck = async (point) => {
    setCheck({ loading: true, error: '', result: null }); setPicked(point);
    try { setCheck({ loading: false, error: '', result: await apiRequest(`/safety?lat=${point.lat}&lng=${point.lng}${night ? '&time=night' : ''}`) }); }
    catch (e) { setCheck({ loading: false, error: e.message, result: null }); }
  };

  const handleMapPick = (point) => {
    const mode = pickMode;
    setPickMode(null); setSidebarOpen(true);
    if (mode === 'report') { setPicked(point); setReportLocation({ ...point, name: '' }); setReportOpen(true); }
    else if (mode === 'place') { setPicked(point); setPlaceLocation(point); setPlaceOpen(true); }
    else if (mode === 'check') { setTab('insights'); runCheck(point); }
    else if (mode === 'routeFrom') {
      setRoute((r) => ({ ...r, from: point, result: null, error: '' }));
      if (route.to) runRoute(point, route.to, night); else startPick('routeTo');
    } else if (mode === 'routeTo') {
      setRoute((r) => ({ ...r, to: point, result: null, error: '' }));
      if (route.from) runRoute(route.from, point, night); else startPick('routeFrom');
    }
  };

  const submitReport = async (input) => {
    const { report } = await apiRequest('/reports', { method: 'POST', body: input, token });
    setReports((c) => [report, ...c.filter((r) => r.id !== report.id)].slice(0, 1000));
    setSelectedReport(report); setSelectedIncident(null); setPicked(null); setReportLocation(null);
    notify('Report added. Zone colours update as others confirm it.', 'success');
    loadLayers(night);
  };

  const submitPlace = async (input) => {
    const { place } = await apiRequest('/places', { method: 'POST', body: input, token });
    setPlaces((c) => [place, ...c]); setSelectedPlaceId(place.id); setPicked(null); setPlaceLocation(null);
    focusOn({ center: [place.lat, place.lng], zoom: 16 });
    notify(place.status === 'VERIFIED' ? 'Place added and verified.' : 'Place added — it shows as verified once 3 people confirm it.', 'success');
  };

  const applyUpdate = (kind, item) => {
    if (kind === 'places') setPlaces((c) => c.map((p) => (p.id === item.id ? item : p)));
    else { setReports((c) => (item.status === 'REJECTED' ? c.filter((r) => r.id !== item.id) : c.map((r) => (r.id === item.id ? item : r)))); setSelectedReport((s) => (s?.id === item.id ? (item.status === 'REJECTED' ? null : item) : s)); }
    if (item.status === 'REJECTED' && kind === 'places') setPlaces((c) => c.filter((p) => p.id !== item.id));
    loadLayers(night);
  };
  const handleVote = async (kind, id, vote) => {
    try {
      const res = await apiRequest(`/${kind}/${id}/vote`, { method: 'POST', body: { vote }, token });
      const item = res.place || res.report;
      applyUpdate(kind, item);
      notify(item.status === 'VERIFIED' ? 'Thanks — this is now verified!' : 'Thanks for your vote.', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };
  const handleAdminStatus = async (kind, id, status) => {
    try { const res = await apiRequest(`/${kind}/${id}/status`, { method: 'PATCH', body: { status }, token }); applyUpdate(kind, res.place || res.report); notify(`Marked ${status.toLowerCase()}.`, 'success'); }
    catch (e) { notify(e.message, 'error'); }
  };

  const locate = () => {
    if (!navigator.geolocation) { notify('Location is not supported in this browser.', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }; setUserPos(p); focusOn({ center: [p.lat, p.lng], zoom: 15 }); },
      () => notify('Could not get your location. Allow location access in the browser.', 'error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const loadBriefing = async () => {
    setBriefing((b) => ({ ...b, loading: true, error: '' }));
    try { setBriefing({ loading: false, error: '', data: await apiRequest(`/briefing?location=${encodeURIComponent(locationQuery)}${night ? '&time=night' : ''}`) }); }
    catch (e) { setBriefing((b) => ({ ...b, loading: false, error: e.message })); }
    loadHealth();
  };

  const selectIncident = (incident) => {
    setSelectedIncident(incident); setSelectedReport(null); setSidebarOpen(true);
    if (incident.location) focusOn({ center: [incident.location.lat, incident.location.lng], zoom: 14 });
    else if (incident.roadId) { const road = roads.find((r) => r.id === incident.roadId); const b = road && boundsOf(road.paths); if (b) focusOn({ bounds: b, maxZoom: 12 }); }
  };
  const selectReport = (report) => { setSelectedReport(report); setSelectedIncident(null); setSidebarOpen(true); focusOn({ center: [report.lat, report.lng], zoom: 15 }); };
  const selectPlace = (place) => { setSelectedPlaceId(place.id); focusOn({ center: [place.lat, place.lng], zoom: 16 }); };
  const focusItem = (item) => { if (item.type === 'road') { const b = boundsOf(item.paths); if (b) focusOn({ bounds: b, maxZoom: 13 }); } else focusOn({ center: [item.lat, item.lng], zoom: 14 }); };

  const handleReportClick = () => {
    if (selectedIncident?.location) { setReportLocation({ lat: selectedIncident.location.lat, lng: selectedIncident.location.lng, name: selectedIncident.placeName || '' }); setPicked(null); setReportOpen(true); }
    else if (selectedReport) { setReportLocation({ lat: selectedReport.lat, lng: selectedReport.lng, name: selectedReport.locationName || '' }); setReportOpen(true); }
    else startPick('report');
  };

  const changeTopic = (next) => { setTopic(next); searchIncidents(locationQuery, { topicOverride: next }); };
  const visiblePlaces = useMemo(() => places.filter((p) => !placeFilter.length || placeFilter.includes(p.category)), [places, placeFilter]);
  const listCenter = userPos ? [userPos.lat, userPos.lng] : areaCenter;
  const levelCounts = useMemo(() => ['RED', 'ORANGE', 'YELLOW', 'GREEN'].map((l) => [l, [...roads, ...zones].filter((x) => x.level === l).length]), [roads, zones]);
  const hasDemo = [...roads, ...zones, ...places].some((x) => x.source === 'demo-seed');

  return (
    <div className="pattern-bg relative flex h-screen h-[100dvh] w-full overflow-hidden bg-[#050b14] font-sans text-white">
      <style>{`.pattern-bg{background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:20px 20px}.glass-panel{background:rgba(13,20,33,.96);backdrop-filter:blur(16px)}`}</style>

      {sidebarOpen && (
        <Sidebar tab={tab} onTab={setTab}>
          {tab === 'alerts' && <AlertsTab locationQuery={locationQuery} onLocationChange={setLocationQuery} onSearch={() => searchIncidents(locationQuery, { topicOverride: topic })} topic={topic} onTopic={changeTopic} loading={loading} error={error} ai={newsMeta.ai} providers={newsMeta.providers} incidents={incidents} reports={reports} selectedIncident={selectedIncident} selectedReport={selectedReport} onSelectIncident={selectIncident} onSelectReport={selectReport} onReportClick={handleReportClick} onChooseLocation={() => startPick('report')} isPicking={pickMode === 'report'} user={user} onVote={handleVote} onAdminStatus={handleAdminStatus} />}
          {tab === 'places' && <PlacesTab places={places} filter={placeFilter} onFilter={setPlaceFilter} center={listCenter} selectedPlaceId={selectedPlaceId} onSelect={selectPlace} onAdd={() => startPick('place')} />}
          {tab === 'route' && <RouteTab route={route} pickMode={pickMode} onPick={startPick} onClear={() => setRoute({ from: null, to: null, result: null, loading: false, error: '', selected: null })} onSelect={(i) => setRoute((r) => ({ ...r, selected: i }))} night={night} />}
          {tab === 'insights' && <InsightsTab roads={roads} zones={zones} onFocusItem={focusItem} briefing={briefing} onBriefing={loadBriefing} check={check} pickMode={pickMode} onCheck={() => startPick('check')} health={health} />}
        </Sidebar>
      )}

      <main className="relative min-w-0 flex-1 p-2 md:p-4">
        <div className="absolute left-14 right-3 top-4 z-[500] flex flex-wrap items-center gap-2 md:left-16">
          <button type="button" onClick={() => setSidebarOpen((o) => !o)} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-2 text-xs font-semibold shadow-lg hover:bg-slate-900"><PanelLeft className="h-3.5 w-3.5" />{sidebarOpen ? 'Hide panel' : 'Show panel'}</button>
          <button type="button" onClick={() => setNight((n) => !n)} aria-pressed={night} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${night ? 'border-indigo-400/50 bg-indigo-950/90 text-indigo-100' : 'border-white/15 bg-slate-950/90 hover:bg-slate-900'}`}>{night ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}{night ? 'Night view' : 'Day view'}</button>
          <button type="button" onClick={locate} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-2 text-xs font-semibold shadow-lg hover:bg-slate-900"><LocateFixed className="h-3.5 w-3.5" />Locate me</button>
          <button type="button" onClick={() => searchIncidents(locationQuery, { refresh: true, topicOverride: topic })} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-2 text-xs font-semibold shadow-lg hover:bg-slate-900 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh news</button>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-2 text-xs font-semibold shadow-lg hover:bg-slate-900"><Layers className="h-3.5 w-3.5" />Layers</summary>
            <div className="absolute left-0 top-full z-[700] mt-1 w-48 space-y-1 rounded-xl border border-white/15 bg-slate-950/95 p-2 shadow-xl">
              {Object.entries(LAYER_LABELS).map(([id, label]) => <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-white/5"><input type="checkbox" checked={layers[id]} onChange={() => setLayers((l) => ({ ...l, [id]: !l[id] }))} className="accent-indigo-500" />{label}</label>)}
            </div>
          </details>
        </div>

        {pickMode && (
          <div className="absolute left-1/2 top-16 z-[600] flex -translate-x-1/2 items-center gap-3 rounded-full border border-indigo-300/40 bg-slate-950/95 py-2 pl-4 pr-2 text-xs font-semibold text-indigo-100 shadow-xl">
            {PICK_HELP[pickMode]}<button type="button" onClick={cancelPick} aria-label="Cancel" className="rounded-full bg-white/10 p-1 hover:bg-white/20"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {notice && <div role="status" className={`absolute left-1/2 top-4 z-[800] max-w-[90%] -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm shadow-xl ${notice.kind === 'error' ? 'border-red-400/40 bg-red-950 text-red-100' : notice.kind === 'success' ? 'border-emerald-400/40 bg-emerald-950 text-emerald-100' : 'border-white/20 bg-slate-900 text-white'}`}>{notice.message}</div>}

        <div className="h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
          <MapComponent roads={roads} zones={zones} places={visiblePlaces} incidents={incidents} reports={reports} layers={layers} route={route} routePoints={{ from: route.from, to: route.to }} userPos={userPos} pickMode={pickMode} picked={picked} focus={focus} selected={{ incidentId: selectedIncident?.id, reportId: selectedReport?.id, placeId: selectedPlaceId }} user={user} onPick={handleMapPick} onIncidentClick={selectIncident} onReportClick={selectReport} onPlaceClick={(p) => setSelectedPlaceId(p.id)} onVote={handleVote} onAdminStatus={handleAdminStatus} />
        </div>

        <div className="pointer-events-none absolute bottom-7 left-5 z-[500] max-w-[calc(100%-6rem)] rounded-xl border border-white/10 bg-slate-950/90 p-2.5 text-[11px] text-slate-300 shadow-lg md:left-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {levelCounts.map(([level, n]) => <span key={level} className="flex items-center gap-1"><span style={{ background: LEVELS[level].color }} className="h-2.5 w-2.5 rounded-full" />{LEVELS[level].label} <b className="text-white">{n}</b></span>)}
          </div>
          <p className="mt-1 text-slate-500">{night ? '🌙 Night scoring' : '☀️ Day scoring'} · {places.length} safe places · {reports.length} reports{hasDemo ? ' · includes demo data' : ''}</p>
        </div>

        <button type="button" onClick={() => setSosOpen(true)} aria-label="Emergency help" className="absolute bottom-7 right-5 z-[600] flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-sm font-extrabold text-white shadow-[0_0_0_4px_rgba(239,68,68,.3),0_8px_24px_rgba(0,0,0,.5)] hover:bg-red-500 md:right-7">SOS</button>
      </main>

      <ReportModal isOpen={reportOpen} onClose={() => { setReportOpen(false); setReportLocation(null); setPicked(null); }} location={reportLocation} onSubmit={submitReport} />
      <AddPlaceModal isOpen={placeOpen} onClose={() => { setPlaceOpen(false); setPlaceLocation(null); setPicked(null); }} location={placeLocation} onSubmit={submitPlace} onChooseLocation={() => { setPlaceOpen(false); startPick('place'); }} />
      <SosPanel isOpen={sosOpen} onClose={() => setSosOpen(false)} places={places} userPos={userPos} onLocate={locate} />
    </div>
  );
}

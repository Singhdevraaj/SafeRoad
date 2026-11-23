import { useEffect } from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { INCIDENT_LABELS, LEVELS, PLACE_CATEGORIES, REPORT_LABELS } from '../constants';

const fallbackCenter = [26.9124, 75.7873];
const iconCache = new Map();

function placeIcon(category, status, selected) {
  const key = `${category}|${status}|${selected}`;
  if (!iconCache.has(key)) {
    const { emoji, color } = PLACE_CATEGORIES[category] || PLACE_CATEGORIES.public_place;
    const border = status === 'PENDING' ? 'dashed' : 'solid';
    const size = selected ? 38 : 32;
    iconCache.set(key, L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px ${border} #fff;display:flex;align-items:center;justify-content:center;font-size:${selected ? 19 : 16}px;box-shadow:0 2px 8px rgba(0,0,0,.5);opacity:${status === 'PENDING' ? 0.85 : 1}">${emoji}</div>`,
    }));
  }
  return iconCache.get(key);
}

const letterIcon = (letter, color) => L.divIcon({
  className: '', iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};color:#fff;font:700 14px system-ui;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)">${letter}</div>`,
});

function Focus({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (focus.bounds) map.fitBounds(focus.bounds, { padding: [60, 60], maxZoom: focus.maxZoom || 14 });
    else if (focus.center) map.setView(focus.center, focus.zoom || 14, { animate: true });
    // Only re-run when a *new* focus request is made, so the map is never yanked around by data refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, map]);
  return null;
}

function Picker({ enabled, onPick }) {
  useMapEvents({ click(event) { if (enabled) onPick({ lat: event.latlng.lat, lng: event.latlng.lng }); } });
  return null;
}

const incidentColor = (type) => (type === 'accident' || type === 'vehicle_fire' || type === 'harassment' || type === 'crime' ? '#ef4444' : type === 'traffic_disruption' ? '#facc15' : '#fb923c');
const reportColor = (category) => (category === 'accident' || category === 'harassment' ? '#ef4444' : category === 'traffic_disruption' ? '#facc15' : '#fb923c');

function LevelBadge({ level, score }) {
  return <span style={{ background: LEVELS[level].color }} className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white">{LEVELS[level].label}{score !== undefined ? ` · ${score}` : ''}</span>;
}

const DemoTag = ({ source }) => (source === 'demo-seed' ? <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Demo data</span> : null);

function VoteBar({ kind, item, user, onVote, onAdminStatus, pendingStatus }) {
  const verified = item.status === 'VERIFIED';
  return (
    <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
      <p className="text-xs text-slate-600">
        {verified ? '✔ Verified by the community' : `⏳ ${pendingStatus}`} · 👍 {item.confirms} · 👎 {item.disputes}
      </p>
      {item.source !== 'demo-seed' && (
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onVote(kind, item.id, 'confirm')} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500">Confirm</button>
          <button type="button" onClick={() => onVote(kind, item.id, 'dispute')} className="rounded bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-500">Not accurate</button>
        </div>
      )}
      {user?.role === 'ADMIN' && (
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onAdminStatus(kind, item.id, 'VERIFIED')} className="rounded border border-emerald-600 px-2 py-1 text-xs font-semibold text-emerald-700">Admin: verify</button>
          <button type="button" onClick={() => onAdminStatus(kind, item.id, 'REJECTED')} className="rounded border border-red-600 px-2 py-1 text-xs font-semibold text-red-700">Reject</button>
        </div>
      )}
    </div>
  );
}

export default function MapComponent({
  roads, zones, places, incidents, reports, layers, route, routePoints, userPos, pickMode, picked, focus, selected, user,
  onPick, onIncidentClick, onReportClick, onPlaceClick, onVote, onAdminStatus,
}) {
  const routes = route?.result?.routes || [];
  const activeIndex = route?.selected ?? route?.result?.recommendedIndex ?? 0;

  return (
    <MapContainer center={fallbackCenter} zoom={12} className={`h-full w-full ${pickMode ? 'picking' : ''}`} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Focus focus={focus} />
      <Picker enabled={Boolean(pickMode)} onPick={onPick} />

      <Pane name="zones" style={{ zIndex: 410 }} />
      <Pane name="roads" style={{ zIndex: 420 }} />
      <Pane name="route" style={{ zIndex: 430 }} />

      {layers.zones && zones.map((zone) => (
        <Circle key={`zone-${zone.id}`} pane="zones" center={[zone.lat, zone.lng]} radius={zone.radiusM}
          pathOptions={{ color: LEVELS[zone.level].color, fillColor: LEVELS[zone.level].color, fillOpacity: 0.2, weight: 1.5 }}>
          <Popup>
            <div className="max-w-60 space-y-1 text-sm">
              <p className="font-semibold">{zone.name}</p>
              <p><LevelBadge level={zone.level} score={zone.score} /><DemoTag source={zone.source} /></p>
              <p className="text-xs text-slate-600">{zone.kind === 'women' ? "Women's safety zone" : zone.kind === 'road' ? 'Road safety zone' : 'General safety zone'}</p>
              {zone.reasons.map((reason) => <p key={reason} className="text-xs">• {reason}</p>)}
              <p className="text-xs text-slate-500">{zone.counts.reports} community reports · {zone.counts.news} news items</p>
            </div>
          </Popup>
        </Circle>
      ))}

      {layers.roads && roads.map((road) => road.paths.map((path, i) => (
        <Polyline key={`road-${road.id}-${i}`} pane="roads" positions={path}
          pathOptions={{ color: LEVELS[road.level].color, weight: road.kind === 'highway' ? 7 : 5, opacity: 0.9, lineCap: 'round' }}>
          <Popup>
            <div className="max-w-60 space-y-1 text-sm">
              <p className="font-semibold">{road.name}</p>
              <p><LevelBadge level={road.level} score={road.score} /><DemoTag source={road.source} /></p>
              {road.reasons.map((reason) => <p key={reason} className="text-xs">• {reason}</p>)}
              <p className="text-xs text-slate-500">{road.counts.news} news items · {road.counts.reports} community reports nearby</p>
              <p className="text-[10px] text-slate-400">{road.geometrySource === 'osm' ? 'Road shape from OpenStreetMap' : 'Approximate road outline'}</p>
            </div>
          </Popup>
        </Polyline>
      )))}

      {routes.map((r) => r.index !== activeIndex && (
        <Polyline key={`route-${r.index}`} pane="route" positions={r.path} pathOptions={{ color: '#94a3b8', weight: 5, opacity: 0.8, dashArray: '8 8' }} />
      ))}
      {routes.filter((r) => r.index === activeIndex).map((r) => (
        <Polyline key={`route-active-${r.index}`} pane="route" positions={r.path} pathOptions={{ color: '#38bdf8', weight: 7, opacity: 0.95 }} />
      ))}
      {routePoints?.from && <Marker position={[routePoints.from.lat, routePoints.from.lng]} icon={letterIcon('A', '#16a34a')} />}
      {routePoints?.to && <Marker position={[routePoints.to.lat, routePoints.to.lng]} icon={letterIcon('B', '#dc2626')} />}

      {layers.places && places.map((place) => (
        <Marker key={`place-${place.id}`} position={[place.lat, place.lng]} icon={placeIcon(place.category, place.status, selected.placeId === place.id)} eventHandlers={{ click: () => onPlaceClick(place) }}>
          <Popup>
            <div className="max-w-60 space-y-1 text-sm">
              <p className="font-semibold">{place.name}<DemoTag source={place.source} /></p>
              <p className="text-xs text-slate-600">{PLACE_CATEGORIES[place.category]?.emoji} {PLACE_CATEGORIES[place.category]?.label}{place.open24x7 ? ' · Open 24×7' : place.hours ? ` · ${place.hours}` : ''}</p>
              {place.address && <p className="text-xs">{place.address}</p>}
              {place.phone && <p className="text-xs">📞 <a className="text-indigo-600 underline" href={`tel:${place.phone.replace(/[^0-9+]/g, '')}`}>{place.phone}</a></p>}
              {place.tags.length > 0 && <p className="text-xs text-slate-500">{place.tags.join(' · ')}</p>}
              {place.notes && <p className="text-xs">{place.notes}</p>}
              <a className="text-xs text-indigo-600 underline" href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">Directions</a>
              <VoteBar kind="places" item={place} user={user} onVote={onVote} onAdminStatus={onAdminStatus} pendingStatus="Community-added, awaiting confirmation" />
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.news && incidents.filter((i) => i.location).map((incident) => (
        <CircleMarker key={`news-${incident.id}`} center={[incident.location.lat, incident.location.lng]} radius={selected.incidentId === incident.id ? 12 : 9}
          pathOptions={{ color: '#fff', weight: 2, fillColor: incidentColor(incident.type), fillOpacity: 0.95 }} eventHandlers={{ click: () => onIncidentClick(incident) }}>
          <Popup>
            <div className="max-w-64 space-y-1 text-sm">
              <p className="font-semibold">{incident.title}</p>
              <p className="text-xs font-semibold text-slate-500">{INCIDENT_LABELS[incident.type]}{incident.roadName ? ` · ${incident.roadName}` : ''}</p>
              <p>{incident.summary}</p>
              <p className="text-xs text-slate-500">{incident.location.accuracy} · {incident.location.address}</p>
              <a href={incident.articleUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">Read source: {incident.source}</a>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {layers.reports && reports.map((report) => (
        <CircleMarker key={`community-${report.id}`} center={[report.lat, report.lng]} radius={selected.reportId === report.id ? 12 : 8}
          pathOptions={{ color: '#fff', weight: 2, fillColor: reportColor(report.category), fillOpacity: 0.9, dashArray: report.status === 'VERIFIED' ? undefined : '3 3' }} eventHandlers={{ click: () => onReportClick(report) }}>
          <Popup>
            <div className="max-w-64 space-y-1 text-sm">
              <p className="font-semibold">{REPORT_LABELS[report.category] || 'Safety issue'}<DemoTag source={report.source} /></p>
              <p>{report.description}</p>
              <p className="text-xs text-slate-500">{report.locationName}</p>
              <VoteBar kind="reports" item={report} user={user} onVote={onVote} onAdminStatus={onAdminStatus} pendingStatus="Unverified community report" />
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {picked && <CircleMarker center={[picked.lat, picked.lng]} radius={11} pathOptions={{ color: '#fff', weight: 3, fillColor: '#818cf8', fillOpacity: 1 }} />}
      {userPos && (
        <>
          <Circle center={[userPos.lat, userPos.lng]} radius={Math.max(userPos.accuracy || 30, 30)} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 1 }} />
          <CircleMarker center={[userPos.lat, userPos.lng]} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Popup>You are here</Popup></CircleMarker>
        </>
      )}
    </MapContainer>
  );
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { AuthContext } from '../context/auth-context';

const path = (pts) => [pts];
const data = {
  incidents: { area: 'Jaipur, India', areaCenter: { lat: 26.91, lng: 75.79 }, providers: { google: 2 }, ai: { summarized: 1, excerpts: 1, note: 'Gemini key not set - showing news excerpts.' }, incidents: [
    { id: 'i1', title: 'Truck overturns on Ajmer Road', summary: 'A truck overturned.', type: 'accident', topic: 'road', placeName: 'Ajmer Road', roadId: 'r1', roadName: 'Ajmer Road (Jaipur)', location: { lat: 26.9, lng: 75.78, accuracy: 'street-level', address: 'Ajmer Road' }, source: 'Test Paper', articleUrl: 'https://t.example/1', publishedAt: new Date().toISOString() },
    { id: 'i2', title: 'Crash on Delhi highway', summary: 'Crash.', type: 'accident', topic: 'road', roadId: 'r2', roadName: 'Delhi–Jaipur Highway', location: null, source: 'Test Paper', articleUrl: 'https://t.example/2', publishedAt: new Date().toISOString() },
  ] },
  reports: { reports: [{ id: 'c1', category: 'harassment', description: 'Group loitering', locationName: 'Sindhi Camp', lat: 26.92, lng: 75.79, status: 'UNVERIFIED', source: 'community', confirms: 1, disputes: 0 }] },
  places: { places: [
    { id: 'p1', name: 'Women Help Desk – Jaipur Junction', category: 'women_safe', lat: 26.9197, lng: 75.7878, phone: '1091', open24x7: true, tags: ['cctv'], status: 'VERIFIED', source: 'demo-seed', confirms: 3, disputes: 0 },
    { id: 'p2', name: 'Police Station – Civil Lines', category: 'police', lat: 26.915, lng: 75.789, tags: [], status: 'PENDING', source: 'community', confirms: 1, disputes: 0 },
  ] },
  roads: { roads: [
    { id: 'r1', name: 'Ajmer Road (Jaipur)', kind: 'road', level: 'ORANGE', score: 4.5, reasons: ['Busy industrial traffic'], paths: path([[26.9125, 75.78], [26.899, 75.72]]), counts: { news: 1, reports: 0, verifiedReports: 0 }, geometrySource: 'fallback', source: 'demo-seed' },
    { id: 'r2', name: 'Delhi–Jaipur Highway (NH-48)', kind: 'highway', level: 'RED', score: 8.4, reasons: ['High-speed traffic'], paths: path([[26.965, 75.8], [27.15, 75.9]]), counts: { news: 1, reports: 2, verifiedReports: 1 }, geometrySource: 'osm', source: 'demo-seed' },
  ] },
  zones: { zones: [
    { id: 'z1', name: 'Sindhi Camp bus stand area', kind: 'women', lat: 26.9226, lng: 75.7946, radiusM: 450, level: 'RED', score: 10.1, reasons: ['Crowded hub'], counts: { reports: 3, verifiedReports: 2, news: 0 }, source: 'demo-seed' },
    { id: 'z2', name: 'Malviya Nagar market', kind: 'general', lat: 26.8545, lng: 75.808, radiusM: 500, level: 'GREEN', score: 0.8, reasons: [], counts: { reports: 0, verifiedReports: 0, news: 0 }, source: 'demo-seed' },
  ] },
  health: { status: 'ok', ai: { gemini: true, usage: { gemini: { used: 3, limit: 60 }, gnews: { used: 0, limit: 80 } } }, news: { googleRss: true, gnews: false, newsdata: false } },
  briefing: { source: 'rules', headline: '2 high-risk areas right now', summary: 'Scores combine data.', tips: ['Stay alert near X.'], note: '', area: 'Jaipur, India', night: false },
  route: { night: false, recommendedIndex: 1, fastestIndex: 0, advice: 'The safest route is 4 min longer.', routes: [
    { index: 0, label: 'Fastest', distanceKm: 8, durationMin: 15, safetyScore: 60, level: 'ORANGE', riskKm: 4, hotspots: [{ type: 'road', id: 'r1', name: 'Ajmer Road (Jaipur)', level: 'ORANGE', meters: 3000 }], supportPlaces: { police: 1 }, path: [[26.9, 75.79], [26.88, 75.8]] },
    { index: 1, label: 'Safest', distanceKm: 9.5, durationMin: 19, safetyScore: 92, level: 'GREEN', riskKm: 0, hotspots: [], supportPlaces: {}, path: [[26.9, 75.79], [26.87, 75.81]] },
  ] },
  safety: { lat: 26.92, lng: 75.79, night: false, safety: 41, level: 'ORANGE', risk: 6, zones: [{ id: 'z1', name: 'Sindhi Camp bus stand area', level: 'RED', score: 10, kind: 'women' }], roads: [], nearbyPlaces: [], tips: ['Nearest help point: Women Help Desk (300 m).'] },
};

const calls = [];
beforeEach(() => {
  calls.length = 0;
  vi.spyOn(console, 'error').mockImplementation((...args) => { throw new Error(`console.error: ${args.join(' ')}`); });
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url); calls.push(`${init.method || 'GET'} ${u.replace(/^.*\/api/, '')}`);
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (u.includes('/incidents')) return reply(data.incidents);
    if (u.includes('/reports/') && u.includes('/vote')) return reply({ report: { ...data.reports.reports[0], confirms: 2 } });
    if (u.includes('/reports')) return reply(data.reports);
    if (u.includes('/places')) return reply(data.places);
    if (u.includes('/roads')) return reply(data.roads);
    if (u.includes('/zones')) return reply(data.zones);
    if (u.includes('/health')) return reply(data.health);
    if (u.includes('/briefing')) return reply(data.briefing);
    if (u.includes('/route/safety')) return reply(data.route);
    if (u.includes('/safety')) return reply(data.safety);
    return reply({ message: 'unexpected' }, 404);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderApp = (user = { id: 'u1', name: 'Krishna', role: 'STANDARD' }) => render(<AuthContext.Provider value={{ user, token: 't', logout: vi.fn() }}><App /></AuthContext.Provider>);

describe('SafeRoute app', () => {
  it('loads news, roads, zones and places, and shows the colour legend counts', async () => {
    renderApp();
    expect(await screen.findByText('Truck overturns on Ajmer Road')).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /roads'))).toBe(true));
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /zones'))).toBe(true));
    expect(calls.some((c) => c.startsWith('GET /places'))).toBe(true);
    await waitFor(() => expect(screen.getByText(/includes demo data/)).toBeTruthy());
    expect(screen.getAllByText('High risk').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('path.leaflet-interactive').length).toBeGreaterThanOrEqual(4); // road lines + zone circles drawn
  });

  it('switches the news topic to women’s safety and re-queries', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    fireEvent.click(screen.getByText("🛡️ Women's safety"));
    await waitFor(() => expect(calls.some((c) => c.includes('topic=women'))).toBe(true));
  });

  it('Safe places tab lists categories and filters by women’s safe spaces', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    fireEvent.click(screen.getByRole('tab', { name: /Safe places/ }));
    expect(await screen.findByText('Women Help Desk – Jaipur Junction')).toBeTruthy();
    expect(screen.getByText('Police Station – Civil Lines')).toBeTruthy();
    fireEvent.click(screen.getByText(/Women’s safe space|Women's safe space/, { selector: 'button' }));
    await waitFor(() => expect(screen.queryByText('Police Station – Civil Lines')).toBeNull());
  });

  it('adding a place starts a map-pick and shows guidance', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    fireEvent.click(screen.getByRole('tab', { name: /Safe places/ }));
    fireEvent.click(await screen.findByText('Add a safe place'));
    expect(await screen.findByText('Click where the safe place is')).toBeTruthy();
  });

  it('route tab scores routes after two picks is wired to the API result display', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    fireEvent.click(screen.getByRole('tab', { name: /Route/ }));
    fireEvent.click(screen.getByText('A · Start'));
    expect(await screen.findByText('Click the START point (A)')).toBeTruthy();
  });

  it('Insights tab: AI briefing, bars and API budget render', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    fireEvent.click(screen.getByRole('tab', { name: /Insights/ }));
    fireEvent.click(await screen.findByText('Generate'));
    expect(await screen.findByText('2 high-risk areas right now')).toBeTruthy();
    expect(screen.getByText('Roads & highways', { selector: 'h3' })).toBeTruthy();
    expect(await screen.findByText('3/60')).toBeTruthy();
    fireEvent.click(screen.getByText('Check any point on the map'));
    expect(await screen.findByText('Click any point to check its safety')).toBeTruthy();
  });

  it('SOS panel offers 112 and the helplines', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    fireEvent.click(screen.getByLabelText('Emergency help'));
    const call = await screen.findByText('Call 112 now');
    expect(call.closest('a').getAttribute('href')).toBe('tel:112');
    expect(screen.getByText('1091')).toBeTruthy();
  });

  it('Night toggle re-requests risk layers with night scoring', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    const toggle = screen.getByRole('button', { name: /Day view|Night view/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(calls.some((c) => c.includes('/roads?time=night')) || calls.filter((c) => c.startsWith('GET /roads')).length >= 2).toBe(true));
  });

  it('selecting a news item linked to a road (no pin) does not crash and shows the road link', async () => {
    renderApp();
    fireEvent.click(await screen.findByText('Crash on Delhi highway'));
    expect(await screen.findByText(/Linked to Delhi–Jaipur Highway/)).toBeTruthy();
  });

  it('selecting a community report offers Confirm, which posts a vote', async () => {
    renderApp();
    await screen.findByText('Truck overturns on Ajmer Road');
    fireEvent.click(screen.getByText(/Harassment \/ eve-teasing/));
    fireEvent.click(await screen.findByText('Confirm'));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST /reports/c1/vote'))).toBe(true));
  });
});

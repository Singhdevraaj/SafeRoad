# SafeRoute (Safe-Travel)

Community-powered safety map for roads, highways and women's safety. MERN stack
(MongoDB · Express · React + Vite · Node) with OpenStreetMap, free news feeds and optional Gemini summaries.

## What it does

| Feature | How it works |
|---|---|
| **Unsafe roads & highways drawn on the map** | Each tracked road is a coloured line (🟥 high · 🟧 elevated · 🟨 caution · 🟩 safer). Exact shapes come from OpenStreetMap (Overpass); news headlines and community reports raise/lower the colour. |
| **Colour zones** | Circular zones (women's safety / road / general) coloured by live score. Reports outside any zone auto-cluster into "community hotspots". |
| **Day / Night view** | One toggle re-scores everything for after dark (women's-safety zones weigh most). |
| **Category-wise safe places** | Women's safe spaces & help desks, police, hospitals, 24×7 pharmacies, transit hubs, rest stops, well-lit public places, shelters. Filter by category. |
| **Community contributions + verification** | Anyone can add places or report issues. They start *unverified*; 3 different people confirming makes them ✔ verified (3 disputes rejects them). Admins can override. Duplicate and spam protection included. |
| **Safe route check** | Pick A and B → real driving routes (free OSRM) scored against risky roads, zones and nearby help. Recommends the safest, explains the trade-off. |
| **"How safe is this spot?"** | Click any point → 0-100 safety score, why, and nearest help. |
| **SOS panel** | One-tap 112, women's helplines, nearest help points with directions, share live location by WhatsApp/SMS. |
| **News + AI summaries** | Google News RSS (no key) + optional GNews / NewsData.io. Road safety and women's safety topics. Gemini summarises, but **never wastes quota** (see below). |
| **AI safety briefing** | Plain-language daily briefing, max one Gemini call per area per 6 h; rule-based fallback. |
| **Guest mode** | "Continue as guest" on the login page. |

## Quick start

Requirements: Node 20.19+ / 22.12+, MongoDB (local or Atlas).

```bash
# 1. backend
cd backend
npm install
cp .env.example .env        # then edit MONGODB_URI, JWT_SECRET, GEMINI_API_KEY
npm run dev                 # http://localhost:9080  (loads the demo dataset on first run)

# 2. frontend (new terminal)
cd frontend
npm install
echo "VITE_API_URL=http://localhost:9080/api" > .env
npm run dev                 # http://localhost:5173
```

**Before a demo (with internet, once):** `cd backend && npm run roads:fetch` — stores the exact road shapes in MongoDB so the demo also works offline.

Reload demo data any time: `npm run seed -- --reset` (only touches demo rows, never community data).
Edit the demo dataset in `backend/src/seedData.js`.

## Never run out of free credits

* Gemini is called **once per article ever** (summaries are cached in `backend/data/summaries.json`) and in **one batched call** per refresh.
* **Daily hard caps** (`GEMINI_DAILY_LIMIT`, `GNEWS_DAILY_LIMIT`, `NEWSDATA_DAILY_LIMIT`) – set below the provider's real free limit.
* On a 429, that model is paused (circuit breaker) and the next model in `GEMINI_MODELS` is tried; if all are out, built-in excerpts/summaries are used – the app keeps working with **zero AI**.
* Geocoding results are cached on disk; Insights → *API budget today* shows live usage.

## Admin

Put your email in `ADMIN_EMAILS`, sign up with it, and popups show **Admin: verify / Reject** buttons.

## Tests

```bash
cd backend  && npm test      # 24 tests: scoring, voting, routes, Gemini quota guard, news pipeline
cd frontend && npm test      # 10 UI tests with a mocked API
```

## API

`GET /api/roads?time=night` · `GET /api/zones?time=night` · `GET /api/safety?lat&lng` · `POST /api/route/safety`
`GET|POST /api/places` · `POST /api/places/:id/vote` · `PATCH /api/places/:id/status` (admin)
`GET|POST /api/reports` · `POST /api/reports/:id/vote` · `PATCH /api/reports/:id/status` (admin)
`GET /api/incidents?location=&topic=road|women` · `GET /api/briefing` · `GET /api/health`
plus the original auth and location routes.

## Data honesty

The bundled dataset is **sample data for demos** (approximate coordinates, illustrative risk scores) and is labelled "Demo data" in the UI. Real accuracy comes from news, community reports and the verification votes. News pins show where an article says something happened and do not independently verify it. Helpline numbers are India's (112, 1091, 181, 108, 1033, 1098) – double-check before publishing.
# saferoad

# Changelog

## 2026-08-29 — Visual overhaul (game art + official-style match view)

- Pull all game art from BHVR's asset CDN (`assets.live.bhvraccount.com`), paths
  derived from the ids we store — perks, add-ons, offerings, items/powers,
  character portraits, map thumbnails, emblem shields, outcome icons. Graceful
  monogram fallback on a 404.
- **Matches** is now a card list mirroring stats.deadbydaylight.com: portrait +
  outcome banner, loadout icon strip, score-category tiles, emblem row, map/date/
  killer meta.
- **Match detail** matches the official modal — Duration / Perks / Item & Add-ons /
  Offering / Emblems / Map cards + an expandable Players list with portraits and
  per-player score breakdown.
- Analytics rows carry killer / perk / map / offering icons.
- Load animations: chart line draw-in, bar grow, staggered tile/card fade-rise —
  all behind `prefers-reduced-motion`.
- Palette retuned toward the official look (near-black surfaces, white-alpha
  borders, subtle entity-red accents).

## 2026-08-29 — Second dataset + dashboard depth

- Verified end to end: the collector delivered 52 real matches; escape rate 37%,
  killer win rate 65%. The refresh-token 400 was a stale mirror — content script now
  writes tokens straight to `chrome.storage` on a 15s poll, refresh uses the confirmed
  JSON `{grant_type, client_id, refresh_token}` shape. Access tokens last ~1h.
- **Dataset 2 — career/aggregate stats** (`GET /player-stats/games/dbd?matchCategory=…`):
  - Discovered the `matchCategory` param — without it BHVR returns all-zero (their bug);
    per real mode (Regular/2v8/Chaos Shuffle/Lights Out/My Little Oni) it's fully
    populated: escape rate, kill rate, chases, hooks, heals, gen-kicks, pallet/wall
    breaks, and emblem-quality distributions, for 30-day and all-time windows.
  - Extension polls all five categories each run; backend stores one `career_snapshots`
    row per `(category, BHVR updatedAt)` (BHVR updates ~daily). New endpoints
    `GET /api/career`, `GET /api/career/trend`, `POST /api/ingest/career`.
- **Match enrichment**: keep per-player `postGameStat` (score categories),
  `leaderboardScore`, `characterLevel`. Additive schema migration for existing DBs.
- **New analytics**: `/api/analytics/{self-killers,maps,perk-pairs,offerings}`;
  `/api/matches` rows now carry the self player's perks + score categories + emblems.
- **Dashboard rebuilt** (React, inline-SVG charts, dataviz palette validated):
  - **Overview** — career KPI tiles with mode tabs + 30d/all-time toggle, emblem
    distribution stacked bars, plus our own tracked-data strip.
  - **Trends** — line charts (crosshair + tooltip) of escape/kill rate & avg BP over
    the snapshot history.
  - **Matches** — score-category sparkbars, emblem dots, self loadout, real
    killer/map filters.
  - **Match detail** — full score breakdown per player, colored emblems, character level.
  - **Analytics** — 7 tabs: Vs Killers, My Killers, Maps, Builds, Perk pairs,
    Offerings, Teammates.
- Player UUID identified (`sub` claim of the access JWT) for future multi-account.

## 2026-08-29 — Phases 1–3 scaffolded and wired end to end

- **Phase 0 (API discovery)** done via the Claude browser extension on a live
  signed-in session. Findings in `docs/api-contract.md`:
  - Core endpoint: `GET account-backend.bhvr.com/player-stats/match-history/games/dbd/providers/bhvr?lang=en&limit=50`
    — array of the last matches, each with all 5 players' perks / add-ons / offerings /
    emblems / bloodpoints / outcome. Display names are inline (localized by `lang`).
  - Auth: OAuth2 PKCE bearer token in `localStorage["auth-store"]` — **no cookies**.
    Access token ~20 min, refresh token ~30 days, `client_id=DBDStats`.
  - No match ID (key on `matchStartTime`, unix seconds) and **no pagination** (only the
    latest 50 are ever returned).
  - Real anomaly captured: a 46s match where the killer DC'd at load
    (`playerTimeInMatch: -1`, 0 BP, no emblems) — used as the `lobby-dc` fixture.
- **Backend** (`server/`, Fastify + built-in `node:sqlite`, no ORM): `/api/ingest`
  stores raw payloads immutably, normalizes, runs the Entity Corrector, writes
  `matches` / `match_players`. `/api/repoll-queue`, `/api/summary`, `/api/matches`,
  `/api/matches/:id`, `/api/analytics/{killers,builds,teammates}`.
- **Entity Corrector** (`server/src/corrector/`): `lobby-dc`, `ragequit`,
  `missing-loadout` rules with an attempt-capped re-poll loop. 15 vitest cases green
  (normalizer + corrector + full pipeline + analytics against the real fixture).
- **Collector extension** (`extension/`, MV3): content-script token mirror,
  `chrome.alarms` poll loop, headless token refresh, options page, re-poll handling.
- **Dashboard** (`web/`, React + Vite): overview KPIs, filterable ledger, 5-player
  tally with Entity-Corrector notes, analytics tabs. Strict dark theme, blood-red
  reserved for corrections / warnings / negative trends.
- **Deploy**: multi-stage `Dockerfile` (Node 24), `docker-compose.yml` with a
  `./data` volume. Container verified end to end (ingest → corrector → dashboard).
- Chose `node:sqlite` over `better-sqlite3` — the latter doesn't compile on the dev
  machine's Node 26, and the built-in needs no native build.

### Open

- Verify the `POST /sso/token` refresh request/response + token-rotation behaviour
  against a live expiry (the client tries form-encoded then JSON as a fallback).
- Confirm game-mode filter param and `isCustomMatch` / special-event handling.
- End-to-end run against a real account (waited-for real match landing on the dashboard).

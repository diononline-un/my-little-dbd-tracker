# Changelog

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

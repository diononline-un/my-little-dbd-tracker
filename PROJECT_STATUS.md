---
status: complete
progress: 100
version: "1.0.0"
tags: [node, fastify, node-sqlite, react, vite, mv3-extension, docker, dead-by-daylight, stats, reverse-engineering, archived]
scope: "Self-hosted, single-user DBD match tracker: an MV3 extension polls the official BHVR match-history + career-stats APIs (OAuth bearer, no OCR), a Node backend stores raw payloads immutably and runs the Entity Corrector anomaly pipeline + daily career snapshots, a React dashboard shows match history, career overview, trend + estimated-grade charts and archetype/build/map analytics. Docker-first."
last_updated: "2026-09-01"
successor: "The hosted, multi-user product continues privately as diononline-un/entity-track (accounts, OBS overlays, friend system, billing). This repo is the finished hobby build and is archived."
next_steps: []
---

# Done

`v1.0.0` — frozen and archived. Everything below is implemented, covered by the
vitest suite (47 cases), and verified end to end against real captured payloads.

## What it is

- **`extension/`** (MV3) — `content.js` mirrors the OAuth bundle from
  `stats.deadbydaylight.com`'s `localStorage`; the service worker refreshes the
  ~1 h access token itself (`chrome.alarms`, never `setInterval`) and pulls the
  last-50 match history + 5 career categories, POSTing them with `X-Ingest-Token`.
- **`server/`** (Fastify + `node:sqlite`, no ORM, no native build) —
  `POST /api/ingest` stores the raw payload **verbatim + immutable**, normalizes
  it, runs the Entity Corrector, writes `matches` / `match_players`. Second
  dataset: per-mode career aggregates as daily `career_snapshots`.
- **Entity Corrector** (`server/src/corrector/`) — ordered rules that annotate
  anomalies without touching the raw payload: `lobby-dc` → `outcome = 'canceled'`,
  `ragequit`, `missing-loadout` (deferred re-poll via `GET /api/repoll-queue`).
- **`web/`** (React + Vite, inline-SVG charts) — Overview feed, per-character
  win streaks, an estimated grade derived from the 4 emblem qualities, a
  filterable match ledger with a combined 0–40k score bar, likely-factors per
  match, trend lines, and analytics tabs (vs killers, my killers, maps, builds,
  perk pairs, offerings, teammates).
- **Deploy** — multi-stage `Dockerfile` + `docker-compose.yml`, `./data` volume.

## BHVR API (see `docs/api-contract.md`)

Two endpoints are the whole stats surface: `match-history` (last 50, full
detail) and per-mode career aggregates. No match id (keyed on `matchStartTime`),
no pagination, no pips/grade/MMR, no per-match chase time.

## Known caveat

`POST /sso/token` was never observed against a *live* access-token expiry, so
headless refresh is bounded by the 30-day refresh-token lifetime — revisit
`stats.deadbydaylight.com` if both tokens ever lapse.

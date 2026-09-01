---
status: complete
progress: 100
version: "1.0.0"
tags: [node, fastify, node-sqlite, react, vite, mv3-extension, docker, dead-by-daylight, stats, reverse-engineering, archived]
scope: "Self-hosted, single-user DBD match tracker: MV3 extension polls the official BHVR match-history + career-stats APIs (OAuth bearer, no OCR), Node backend stores raw payloads immutably + runs the Entity Corrector anomaly pipeline + daily career snapshots, React dashboard with match history, career overview, trend charts, estimated-grade and archetype/build/map analytics. Docker-first."
last_updated: "2026-09-01"
successor: "The hosted, multi-user product continues privately as diononline-un/entity-track (accounts, OBS overlays, friend system, billing). This repo is the finished hobby version and is archived."
next_steps: []
---

# Done

This is `v1.0.0` — the hobby build, frozen and archived. Everything below is
implemented, tested (47 vitest cases), and verified end to end against real
captured payloads.

The one known caveat carried from development: `POST /sso/token` was never
observed against a *live* token expiry, so headless refresh is bounded by the
30-day refresh-token lifetime — revisit `stats.deadbydaylight.com` if both
tokens ever lapse.

# Aktueller Stand

Phasen 1–3 stehen, **end-to-end verifiziert** (52 echte Matches über die Extension
eingespielt), plus zweites Dataset (Career-Stats) und ausgebautes Dashboard.

## Neu (2. Iteration)

- **Career-Dataset**: `matchCategory`-Param entdeckt — ohne ihn liefert BHVR nur Nullen
  (deren Bug), pro Modus voll befüllt (escapeRate, killRate, Chases, Hooks, Heals,
  Gen-Kicks, Emblem-Verteilung, 30d + all-time). Extension pollt alle 5 Kategorien,
  Backend speichert `career_snapshots` (dedup pro `(category, updatedAt)`), Endpoints
  `/api/career` + `/api/career/trend`.
- **Match-Anreicherung**: `postGameStat` / `leaderboardScore` / `characterLevel` pro
  Spieler bleiben jetzt erhalten (additive Migration).
- **Analytics**: `/api/analytics/{self-killers,maps,perk-pairs,offerings}`.
- **Dashboard**: top-nav responsive shell. Overview (Recap-Card mit Wochenvergleich +
  Streak-Badges + Career-Kacheln + Emblem-Bars), Insights (Score-Radars, Usage-vs-
  Performance-Scatter, Activity-Heatmap, Sessions, Gegner-Meta), Streaks (per-Character
  Leaderboard), Trends (Linien-Charts), Matches (offizieller Karten-Look mit Gegner-
  Spalte, Inline-Expand), Analytics (7 Tabs).
- **Insights aus akkumulierter History**: Win-Streaks (overall/Rolle/per-Character),
  Recent-Form, Sessions, Recap, Killer-Meta, Gegner-Perk-Meta, Score-Profile. Das
  ist der Kern-Value, da BHVR nur 50 Matches + Tages-Aggregate hergibt.

---

Ursprüngliche Phasen 1–3 gegen echten Payload getestet:

- **Phase 0 (API-Discovery) abgeschlossen** — via Claude-Browser-Extension an einer
  eingeloggten Session. Alles in `docs/api-contract.md`:
  - Endpoint: `GET account-backend.bhvr.com/player-stats/match-history/games/dbd/providers/bhvr?lang=en&limit=50`
  - Auth: OAuth2-PKCE-Bearer-Token in `localStorage["auth-store"]`, **keine Cookies**.
    Access-Token ~20 min, Refresh-Token ~30 Tage, `client_id=DBDStats`.
  - Keine Match-ID (Key = `matchStartTime`), **keine Pagination** (immer nur die letzten 50).
- **Backend** (`server/`): Fastify + eingebautes `node:sqlite` (kein ORM, kein
  Native-Build). Raw-Payloads immutable, Normalizer, Entity Corrector, Analytics-Endpoints.
- **Entity Corrector**: `lobby-dc`, `ragequit`, `missing-loadout` + Re-Poll-Loop mit
  Attempt-Cap. 15 vitest-Tests grün.
- **Extension** (`extension/`, MV3): Content-Script spiegelt Token, Service-Worker mit
  `chrome.alarms`, Headless-Token-Refresh, Options-Page.
- **Dashboard** (`web/`, React+Vite): Overview-KPIs, filterbares Ledger, 5-Spieler-
  Tally mit Korrektur-Notes, Analytics-Tabs. Strikt dark, Blutrot nur für Korrekturen/
  Warnungen/negative Trends.
- **Deploy**: Multi-Stage-`Dockerfile` (Node 24) + `docker-compose.yml`, `./data`-Volume.
  Container end-to-end verifiziert (Ingest → Corrector → Dashboard).

## Wichtigstes offenes Risiko

Der Token-Refresh (`POST /sso/token`) wurde noch **nicht** an einem echten Ablauf
verifiziert (Discovery-Session hat den POST blockiert). Solange das nicht bestätigt ist,
ist der „Tab dauerhaft zu"-Betrieb nicht garantiert — Fallback: `stats.deadbydaylight.com`
neu besuchen, wenn beide Tokens abgelaufen sind. Bounded ohnehin durch die 30-Tage-
Lebensdauer des Refresh-Tokens.

## Repo

- github.com/diononline-un/entitytrack (privat). Container läuft self-hosted auf
  `localhost:2012` (docker compose, `restart: unless-stopped`).
- Access-Token-Lebensdauer korrigiert: ~1 h (nicht 20 min). Refresh-Request-Format
  bestätigt (JSON), nur die Response-Form noch offen.

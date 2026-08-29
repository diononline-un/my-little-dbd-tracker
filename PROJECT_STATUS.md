---
status: in-development
progress: 55
version: "0.0.1"
tags: [node, fastify, node-sqlite, react, vite, mv3-extension, docker, dead-by-daylight, stats, reverse-engineering]
scope: "Self-hosted DBD match tracker: MV3 extension polls the official stats.deadbydaylight.com match-history API (OAuth bearer, no OCR), Node backend stores raw payloads immutably + runs the Entity Corrector anomaly pipeline, React dashboard for match history and archetype/build analytics. Docker-first, Postgres-swappable."
last_updated: "2026-08-29"
next_steps:
  - Verify POST /sso/token refresh (request encoding, response shape, refresh-token rotation) against a live token expiry — client currently tries form-encoded then JSON
  - Load the extension unpacked in Brave, run one real end-to-end poll, confirm a real match lands on the dashboard within ~10 min
  - Confirm match-history game-mode filter param + isCustomMatch / specialEventId behaviour (all captured matches were gameType "Online")
  - Tune corrector thresholds (lobby-dc KILLER_MIN_BP, ragequit ratios) against more real anomaly samples
  - Dashboard polish: map/killer filter dropdowns from real vocab, charts, empty states
---

# Aktueller Stand

Phasen 1–3 des PRD stehen und sind gegen einen **echten** eingefangenen Payload getestet.

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

- Kein GitHub-Remote bisher. `git init` gemacht, noch kein Commit.

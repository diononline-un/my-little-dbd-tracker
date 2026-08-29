---
status: in-development
progress: 70
version: "0.0.1"
tags: [node, fastify, node-sqlite, react, vite, mv3-extension, docker, dead-by-daylight, stats, reverse-engineering]
scope: "Self-hosted DBD match tracker: MV3 extension polls the official BHVR match-history + career-stats APIs (OAuth bearer, no OCR), Node backend stores raw payloads immutably + runs the Entity Corrector anomaly pipeline + daily career snapshots, React dashboard with match history, career overview, trend charts and archetype/build/map analytics. Docker-first, Postgres-swappable."
last_updated: "2026-08-29"
next_steps:
  - Verify POST /sso/token refresh RESPONSE body shape against a live token expiry (request shape confirmed: JSON {grant_type, client_id, refresh_token}); client handles both {authToken,...} and OAuth {access_token,...}
  - Reload the extension so it starts sending career snapshots; confirm Overview + Trends populate
  - Tune corrector thresholds (lobby-dc KILLER_MIN_BP, ragequit ratios) against more real anomaly samples
  - Backfill post_game_stat/character_level on the ~50 pre-enrichment matches (re-poll overwrites recent ones automatically; older ones stay sparse)
  - Confirm isCustomMatch / specialEventId handling (all captured matches were gameType "Online", no events)
---

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
- **Dashboard neu**: Overview (Career-Kacheln + Modus-Tabs + Emblem-Bars), Trends
  (SVG-Linien-Charts), Matches (Score-Sparkbars, Emblem-Dots, Filter), Match-Detail
  (Score-Breakdown), Analytics (7 Tabs). dataviz-Palette validiert.

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

- Kein GitHub-Remote bisher. `git init` gemacht, noch kein Commit.

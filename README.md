# EntityTrack

Automated, OS-agnostic match tracker for Dead by Daylight. Instead of OCR or memory
hooks, it reads the JSON that `stats.deadbydaylight.com` already serves to your
signed-in Behaviour account — exact, tamper-proof, cross-platform.

```
┌─────────────────────┐   match-history JSON    ┌──────────────────┐   REST    ┌───────────────┐
│ Collector extension │ ──────────────────────▶ │  Backend (Node)  │ ◀──────── │  Dashboard    │
│  (MV3, Chrome/Brave)│   POST /api/ingest      │  + Entity        │           │  (React SPA)  │
│  polls every 10 min │                         │    Corrector     │           │               │
└─────────────────────┘                         │  SQLite (/data)  │           └───────────────┘
        ▲                                        └──────────────────┘
        │ reads OAuth token from
        │ localStorage on stats.deadbydaylight.com
```

## Status

Phases 1–3 of the PRD are implemented and tested against a real captured payload.
See `PROJECT_STATUS.md` for what's solid and what's still open (chiefly: live
verification of the OAuth token-refresh call).

## Quick start (self-host)

```bash
cp .env.example .env
# edit .env — set INGEST_TOKEN to a random string (openssl rand -hex 24)

docker compose up -d --build
# dashboard + API on http://localhost:8787
```

Then load the collector:

1. `chrome://extensions` → enable Developer mode → **Load unpacked** → pick `extension/`.
2. Open the extension's **options** page. Set:
   - **Backend URL** — `http://localhost:8787` (or wherever the container is).
   - **Ingest token** — the same value as `INGEST_TOKEN` in `.env`.
3. Visit `https://stats.deadbydaylight.com` once while signed in. The extension mirrors
   your session token and starts polling every 10 minutes — the stats tab can then be
   closed.

New matches show up on the dashboard within ~10 minutes of finishing. History builds
up from when you start collecting (the API only exposes the latest 50 matches, so
there's no historical backfill).

## Development

```bash
npm install
npm test                     # server: normalizer + Entity Corrector + pipeline (vitest)
npm run migrate              # create ./data/entitytrack.db
npm run dev                  # backend on :8787 (node --watch)
npm run dev:web              # dashboard on :5273, proxies /api to :8787
```

Requires Node ≥ 24 for the built-in `node:sqlite` (no native build step).

## How it works

- **`extension/`** — MV3. A content script reads the OAuth bundle from the stats
  site's `localStorage`; the service-worker (`chrome.alarms`, never `setInterval`)
  refreshes the short-lived access token itself and pulls
  `GET /player-stats/match-history/games/dbd/providers/bhvr?lang=en&limit=50`.
- **`server/`** — Fastify. `POST /api/ingest` stores the raw payload **verbatim and
  immutable** (`raw_payloads`), normalizes it (`src/normalize`), runs the Entity
  Corrector (`src/corrector`), and writes `matches` + `match_players`.
- **`server/src/corrector/`** — ordered rules that annotate anomalies (they never
  touch the raw payload):
  - `lobby-dc` — short match + a never-loaded player → `outcome = 'canceled'`,
    excluded from every rate.
  - `ragequit` — a DC after real play time → reclassified `dc` → `ragequit`.
  - `missing-loadout` — a player who played but has a blank loadout → defer, set
    `repoll_after`; the extension re-fetches via `GET /api/repoll-queue`.
  - Any corrected match carries `is_corrected = true` and human-readable
    `correction_notes`, surfaced in red on the dashboard.
- **`web/`** — React + Vite. Dashboard KPIs, filterable match ledger, 5-player tally
  screen, and Killers / Builds / Teammates analytics. Blood-red (`#8B0000`) is used
  only for corrected data, warnings, and negative trends.
- **`docs/api-contract.md`** — the reverse-engineered BHVR API.

## Moving to Postgres

The SQLite specifics live in exactly three files: `server/src/db/`,
`server/src/repository.js`, `server/src/analytics.js`. Reimplement those against `pg`
with the same table shapes (DDL is in `server/src/db/migrate.js`).

## Terms of Use

Automated polling of BHVR's web API with your session token is a grey area under
their Terms ("auto/macro software"). The collector stays at a 10-minute floor and
backs off on errors, but no outcome is guaranteed. Use at your own risk. EntityTrack
is not affiliated with Behaviour Interactive.

## License

MIT — see `LICENSE`.

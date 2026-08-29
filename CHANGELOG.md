# Changelog

## 2026-08-30 — One "win" definition, in one place

- **`server/src/reference/outcomes.js`** is now the single source of truth for
  what a survivor `outcome` means. The win rule, the downed/left/killed sets and
  the decided-vs-neutral split were previously redeclared (slightly differently)
  in `analytics.js`, `normalize/`, `factors.js`, `icons.jsx` and `MatchCard.jsx` —
  they all import from `outcomes.js` (web side: `web/src/outcomes.js`) now.
- **`surrender_draw` is neutral**, not a win. BHVR labels it "ESCAPED" and reuses
  the loss icon for it, but it is a surrender vote, not a real escape — so it is
  excluded from every rate, streak and the form strip, exactly like `canceled`.
  `self_escaped` is `NULL` for those matches (was `1`).
- **`recentForm` filters to decided matches *before* the limit**, so "last 20" is
  really 20 even if a recent match was neutral.
- New tests: `outcomes.test.js`, `factors.test.js` (the heuristic had none), plus
  a `surrender_draw` case in `normalize.test.js`. 39 tests total.

## 2026-08-29 — Recent-form strip reads newest-first

- The **Recent form** strip on the Overview now runs **newest → oldest, left to
  right**, with `now` / `older` end labels — it previously ran oldest→newest with no
  labels, so an old cluster of wins on the left looked like recent form.
- No logic change: a survivor "win" is still exactly `VE_Escaped`; `VE_SurrenderLoss`,
  `VE_Killed`, `VE_Sacrificed` and DCs all count as losses. Verified against raw
  payloads — the wins shown were all genuine hatch/gate escapes.

## 2026-08-29 — Overview is a recent-matches feed

- The Overview now leads with the **last 4 matches in full** (the same detail cards
  as the Matches page) instead of the BHVR career "filter view".
- Order: streak/form pulse → recent matches → weekly recap → tracked totals → form
  trend chart.
- The BHVR career panel (mode tabs, 30-day / all-time toggle, emblem distributions)
  moved to **Insights** as its own section (`CareerPanel` component).

## 2026-08-29 — Role badge, killer pinned top-right, bigger teammate tiles

- **Role badge** (Survivor / Killer, colour-coded) next to the character name — the
  match role is obvious at a glance.
- **Killer pinned to the last opponent tile** (top-right on the card); the three
  survivor tiles are sorted by score among themselves. Section label:
  "Your team & killer" / "Survivors".
- **Bigger teammate tiles** — 28px perk icons, 13px bold score, full-label score
  categories — so you can read what your team ran without opening the match.

## 2026-08-29 — Fixed category order, k-rounding, players by score, portrait-only result

- **Score categories always render in the same order** (Objectives · Altruism ·
  Boldness · Survival / Hunter · Deviousness · Brutality · Sacrifice) — was previously
  JSON key order, which varied per player. `orderedCats()` in `api.js`.
- **k-rounded on the card** (1.5k, 10k); full precision kept in the detail view.
- **Players sorted by score, highest first** — opponent tiles on the card and the
  "Everyone's loadout" list; `/api/matches/:id` returns players in that order too.
- **Dropped the result strip, the kill wash and the score bars.** The `VE_*` symbol
  over each portrait is the result at a glance now — and escapes get theirs too
  (`VE_Escaped`; the API doesn't distinguish gate vs hatch).

## 2026-08-29 — Match card visual pass

- **Map art bleeds in as an atmospheric card background** (heavily masked from the
  right) — instant place identity and colour per match.
- **Score categories → one slim stacked bar + value legend** instead of four plain
  boxes; same on the opponent tiles. You see where the score came from at a glance.
- **Outcome accent**: green left edge for an escape, red for a death (killer matches
  keep the kill-count wash + result strip).
- Bigger score and duration, cleaner meta column, warmer portrait frame, more
  generous spacing and opponent tiles.

## 2026-08-29 — Death ✕, result strip, at-a-glance context

- **Dead players get a red ✕ over a dimmed portrait** (survivors who died / were
  sacrificed), "OUT" for a disconnect — on the card, opponent tiles, and the detail
  tally. `PlayerPortrait` helper in `icons.jsx`.
- **Result strip** across the top of each card: 4 segments — kills (red) for a killer
  match, per-survivor escaped (green) / died (red) / dc (grey) for a survivor match.
  Plus a light-red wash over the whole card that deepens with your kill count.
- **At-a-glance context on the card**: your score vs your role average
  (`avgScoreByRole`), where you fell among the survivors ("1st out" … "last down"),
  and your head-to-head record vs that killer ("vs The Nurse: faced 2× · escaped 0").
- `/api/matches` opponents + self now carry `time_in_match`; the response carries
  `avgScoreByRole` and each match a `deathPosition` + `vsKiller` record.

## 2026-08-29 — Score fix (leaderboard vs BP), bigger card, full opponent tiles

- **The card's "Score" was showing bloodpoints, not the match score.** Fixed — it now
  shows `leaderboardScore` (= the sum of the 4 score categories, what the official site
  calls Score), with bloodpoints as a smaller "· N BP". Same on the detail header and
  every player row.
- **Match card is bigger and reorganised**: portrait + self build + map on top, then a
  full-width row of four generous **opponent tiles** — portrait, name, prestige, score
  + BP, a 4-perk row, and all four score categories. All the other players' data is
  legible without expanding. Score-category tiles for yourself are larger too.
- `/api/matches` opponents now also carry `leaderboardScore`, add-ons, offering,
  power, and `post_game_stat`.

## 2026-08-29 — Prominent opponents, spelled-out loadouts, "likely factors"

- **Match card opponents are now a vertical list** — portrait + name + prestige + BP +
  status + a 4-perk row per opponent, killer row red-tinted with its grade. Everything
  legible at a glance instead of a cramped icon grid.
- **Match detail: nothing is hover-only.** Perks, add-ons, items, offerings are all
  icon + spelled-out name. "Everyone's loadout" shows all 5 players fully expanded —
  perks, item/add-ons, offering, and score categories, no clicking.
- **Likely factors** per match (`analyzeMatch`, `server/src/factors.js`): a heuristic
  read of contributing signals — killer slowdown/endgame stacks, a teammate DC, an
  early chase loss, gen speed from team objective scores, a high-pressure killer,
  second-chance perk loads. Framed as "likely factors, not a verdict"; ＋/－ marked and
  colour-coded. Perk classification lives in `reference/index.js`.

## 2026-08-29 — Opponent loadouts on the card, match-history trends, emblem-score (pip proxy)

- **Match cards show opponent perks** without expanding — a 4-perk strip under each
  opponent portrait; `/api/matches` opponents now carry `perks` + `prestige`.
- **Pips: not in the API.** Verified again — no pip / grade / rank / MMR field anywhere
  in the match payload or `/players/me`. Added a derived **emblem score (0–16)** = sum
  of the 4 emblem qualities (None 0 … Iridescent 4), the closest proxy; shown on the
  card and trended.
- **Trends computed straight from match history** (`/api/insights/history`): rolling
  N-match averages for escape rate, kill rate, overall win rate, avg BP, emblem score —
  available immediately, with a "live estimate, gets more accurate with more matches"
  note. Overview gets a compact Form-trend chart; the Trends page now has a "From your
  tracked matches" section above the BHVR-snapshot section.

## 2026-08-29 — Official-style match cards, inline expand, per-character streaks, recap, sessions, scatter

Informed by community research (NightLight.gg, the dedicated DBD-Winstreak-Tracker,
improvement guides) — streaks and the usage-vs-performance scatter are the most-wanted
unofficial-tracker features.

- **Match cards rebuilt to the `stats.deadbydaylight.com` layout**: ornate CSS
  portrait frame + outcome badge, diamond-framed perks, a middle column with the 4
  opponents (portrait + BP + role icon, killer tile red-tinted), empty add-on slots as
  placeholders, hairline column dividers, map thumbnail. `/api/matches` now returns an
  `opponents` array per row.
- **Inline expand**: clicking a card unfolds the full 5-player tally in place; the
  sectioned body is a shared `MatchDetailBody` component reused by the `/matches/:id`
  page. "open full page ↗" deep-links.
- **Per-character win streaks** — new `/streaks` page: overall/role records, a streak
  leaderboard (best + current per killer / per survivor), "on fire" callouts.
  `/api/insights/character-streaks`.
- **Weekly Recap** card on the Overview — matches, W/L, win rate, best streak, BP,
  most-played / most-faced killer, top perk, each with a week-over-week delta
  (▲ green / ▼ red — red only for a worse number). `/api/insights/recap?offset=`.
- **Session tracking** — matches grouped into play sessions (>45 min gap = new one),
  shown on Insights. `/api/insights/sessions`.
- **Usage-vs-performance scatter** (NightLight's signature chart) on Insights — X =
  matches played/faced, Y = your rate, median quadrant guides. Dimensions: my killers,
  vs killers, perks, maps, offerings. `/api/insights/scatter?dimension=`.
- Nav: added Streaks. Backlog (deferred): OBS overlay, match-sharing links, MMR/grade
  proxy (BHVR doesn't expose it), 4-perk build combos, custom streak goals.

## 2026-08-29 — Streaks, Insights page, more charts

- **API surface confirmed complete**: match-history (last 50, full detail) + career
  aggregates per mode are everything BHVR exposes. `community-stats` is referenced in
  their bundle but 404s (not shipped). No leaderboard / events / per-character /
  historical-beyond-50 endpoints exist. Depth now comes from accumulating match
  history over time.
- **Win-streak counter**: current + best-win + worst-loss streaks, overall / survivor
  / killer, on the Overview (canceled matches are neutral, don't break a streak).
- **Recent-form strip**: W/L timeline of the last 20 decided matches, each linking to
  its detail.
- **New Insights page**: survivor & killer score-category radars (avg/match), a
  contribution-style activity heatmap, "killers you face most" (with portraits + your
  escape rate), and "perks the opposition runs" (survivor + killer meta, with icons).
- New endpoints: `/api/insights/{streaks,form,score-profile,activity,killer-meta,opponent-perks}`.
- Chart components added: Radar, Sparkline, Heatmap.

## 2026-08-29 — Responsive top-nav shell

- Left sidebar → sticky full-width top bar (wordmark + red diamond, horizontal
  nav with red active underline, live "N tracked" pill; menu button under 720px).
- Centered page container (max-width 1400, fluid side padding), red-topped footer.
- All card grids auto-reflow; match cards 3→2→1 col, match-detail a real 3-col
  stepping down at 900/560px. Pill tab controls.

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

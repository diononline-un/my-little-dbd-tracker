# BHVR Stats API — reverse-engineered contract

Captured 2026-08-29 from a logged-in `stats.deadbydaylight.com` session (Next.js SPA).
All data the site shows comes from `account-backend.bhvr.com`; the site renders nothing
of its own. This is the single source of truth EntityTrack ingests.

## Hosts

| Host | Purpose |
|---|---|
| `https://account-backend.bhvr.com` | REST API (auth + stats + match history) |
| `https://account.bhvr.com` | OAuth login UI (interactive, browser only) |
| `https://assets.live.bhvraccount.com` | Static images. Prefix any `image.path` value in a payload with this host. |

## Authentication — OAuth2 PKCE, bearer tokens

There are **no auth cookies**. The SPA stores tokens in `localStorage` under the key
`auth-store` (Zustand persist):

```jsonc
{
  "state": {
    "authToken":    { "token": "<~420 char opaque>", "expirationDate": <ms>, "expired": false },
    "refreshToken": { "token": "<~627 char opaque>", "expirationDate": <ms>, "expired": false }
  },
  "version": 0
}
```

- **Access token TTL ≈ 1 hour** (JWT; observed ~3470s remaining right after a refresh).
  Sent as `Authorization: Bearer <authToken.token>` on every API call. Header name must
  be `Authorization`; raw token without `Bearer ` → 401.
- **Refresh token TTL ≈ 30 days** (JWT). **Rotates on every refresh** — the previous
  refresh token is invalidated, so a client must always use the most recently issued one
  and persist the new bundle after refreshing.
- `client_id` = `DBDStats`.
- **Refresh (confirmed from the SPA bundle):**
  ```
  POST https://account-backend.bhvr.com/sso/token
  Content-Type: application/json
  { "grant_type": "refresh_token", "client_id": "DBDStats", "refresh_token": "<current>" }
  ```
  (axios `.post` with a JSON body — *not* form-encoded. Exactly three keys.)
  Initial login uses `grant_type=authorization_code` (+ `code`, `redirect_uri`,
  `code_verifier`) — interactive, not automatable. Logout: `POST /sso/token/revoke`.
- ⚠️ Still not observed: the refresh *response* body shape. The extension's
  `normalizeTokenResponse` handles both `{ authToken, refreshToken }` and OAuth-style
  `{ access_token, refresh_token, expires_in }`; adjust once seen.
- A stale stored refresh token (SPA rotated it while its own tab was open) → **HTTP 400**
  on refresh. Recovery: revisit stats.deadbydaylight.com so the content script
  re-mirrors the current bundle.
- Unauthorized response shape: `{ "message": "Player not authorized", "code": "...", "traceId": "..." }`, HTTP 401.

### What this means for the extension

A background service worker cannot read another origin's `localStorage`. To get the
token the extension needs **one of**:
1. A content script on `https://stats.deadbydaylight.com/*` that reads `auth-store` and
   mirrors `{authToken, refreshToken}` into `chrome.storage.local` whenever the user
   visits the site, **plus** the worker performing `POST /sso/token` refreshes on its
   own between visits (needs the refresh flow verified — see above).
2. If refresh-without-UI proves unreliable: require the stats tab to be open/pinned, or
   prompt the user to revisit `stats.deadbydaylight.com` when both tokens have expired.

Either way the "zero interaction, tab fully closed for weeks" ideal from the PRD is
**bounded by the 30-day refresh-token lifetime** and by whether headless refresh works.

## Endpoints

### `GET /player-stats/match-history/games/dbd/providers/bhvr`

The core endpoint. Query params: `lang` (e.g. `en`, localizes display names), `limit`.

- `limit` max is **50** (higher is silently clamped).
- **No pagination, no filtering.** `offset`, `page`, `matchCategory`, `character_id`
  are all silently ignored — every call returns the most-recent N matches across all
  modes. You can never fetch matches older than the latest 50. EntityTrack's history is
  built up incrementally by polling; a gap of >50 matches between polls loses matches
  permanently. At a 10-min poll interval this is a non-issue.
- **No match ID field anywhere in the payload.** The only per-match unique key is
  `matchStat.matchStartTime` (unix **seconds**). Use it as the synthetic match id;
  tie-break with `playerRole`/`mapName` if a collision ever occurs.
- Returns a JSON **array** of match objects, newest first.

#### Match object

```jsonc
{
  "matchStat": {
    "gameType":     { "id": "Online", "name": "Online" },
    "isCustomMatch": false,                 // true = KYF/custom, exclude from analytics
    "mapName": "Glo_Level_01",
    "matchDuration": 1018.72,               // float seconds
    "matchStartTime": 1787606284,           // unix SECONDS — the synthetic match id
    "specialEventId": "NONE",
    "map": { "id": "Glo_Level_01", "name": "Ormond Lake Mine", "image": { "path": "maps/Glo_Level_01.png" } }
  },
  "playerStat":  { /* PlayerStat — always the tracked account ("self") */ },
  "opponentStat": [ /* PlayerStat[] — the other 4 players (3 survivors + 1 killer for a
                       survivor match; the 4 survivors for a killer match) */ ]
}
```

Total players = `1 (playerStat) + opponentStat.length`. Normally 5. The self player is
**not** flagged inside `opponentStat` — `playerStat` *is* self.

#### PlayerStat object

```jsonc
{
  "bloodpointsEarned": 193690,
  "characterLevel": 45,
  "platform": "steam",                 // steam | egs | psn | ... ; ABSENT for a player who DC'd pre-load
  "postGameStat": {                    // score categories; keys differ by role, can be {} 
    "DBD_SlasherScoreCat_Hunter": 10000, "DBD_SlasherScoreCat_Deviousness": 3964,
    "DBD_SlasherScoreCat_Brutality": 6300, "DBD_SlasherScoreCat_Sacrifice": 10000
    // survivors: DBD_CamperScoreCat_Objectives | _Altruism | _Boldness | _Survival
  },
  "leaderboardScore": 30264,
  "emblems": [                          // exactly 4; ABSENT for a player who DC'd pre-load
    { "emblem_id": "Emblem_Killer_Chaser", "emblem_name": "CHASER", "emblem_quality": "Gold" }
    // quality: None | Bronze | Silver | Gold | Iridescent
  ],
  "characterClass": null,
  "characterName": {                    // display name is IN the payload — no lookup table needed
    "id": "Shape",                      // inconsistent: legacy slug ("Shape","Smoke") OR coded ("S35","K23")
    "name": "The Shape",
    "image": { "path": "characters/killers/Shape.png" }
  },
  "playerTimeInMatch": 1018,            // int seconds; -1 == did not actually play (DC at load)
  "characterLoadout": {
    "addOns":   [ { "id", "name", "image" }, ... ],   // 0–2
    "offering":   { "id", "name", "image" } | null,
    "perks":    [ { "id", "name", "image" }, ... ],   // 0–4
    "power":      { "id", "name", "image" } | null    // killer power, or survivor item
  },
  "playerRole": "VE_Slasher",           // VE_Slasher = killer, VE_Camper = survivor
  "prestigeLevel": 6,

  // outcome — role-dependent:
  "killerMatchStatus": "MERCILESS KILLER",  // killers only: THE ENTITY HUNGERS... | BRUTAL | RUTHLESS | MERCILESS KILLER
  "playerStatus": {                          // survivors always; killers also when they DC
    "id": "VE_Escaped",                      // VE_Escaped | VE_Killed | VE_Sacrificed | VE_Disconnected | VE_SurrenderLoss | VE_SurrenderDraw
    "name": "ESCAPED",                       // present for terminal states; ABSENT for VE_Surrender* and VE_Disconnected
    "image": { "path": "stats/VE_Escaped.png" }
  }
}
```

#### playerStatus.id vocabulary

| id | meaning |
|---|---|
| `VE_Escaped` | survivor escaped |
| `VE_Killed` | survivor died (bled out / mori / EGC) |
| `VE_Sacrificed` | survivor hooked to death |
| `VE_Disconnected` | player disconnected |
| `VE_SurrenderLoss` | match ended by survivor-vote surrender, this player on losing side |
| `VE_SurrenderDraw` | surrender, treated as a draw / escape (carries `name: "ESCAPED"`) |

### `GET /player-stats/games/dbd/providers/bhvr` — career / aggregate stats (dataset 2)

Powers the `/statistics` page. Query params: `lang`, **`matchCategory`**.

- ⚠️ **Without `matchCategory` (or with `matchCategory=Total`) every detailed field is
  `0`** — a BHVR bug. Query per real category and aggregate yourself.
- Categories (BHVR codename → in-game name): `Regular`→Regular Trials, `Calamari`→2v8,
  `ChocolateBox`→Chaos Shuffle, `Firefly`→Lights Out, `Cake`→My Little Oni. The
  payload's `data["match-categories"]` lists which currently have stats
  (`{name, stats: bool}`).
- The SPA fetches this **server-side** (Next.js RSC) — no XHR on page load. A bearer
  token still works for a direct call.

```jsonc
{
  "data": {
    "30-days":  { "global": { "killers": {...}, "survivors": {...}, "general": {...} } },
    "all-time": { "global": { "killers": {...}, "survivors": {...}, "general": {...} } },
    "match-categories": [ { "name": "Regular", "stats": true }, ... ]
  },
  "updatedAt": 1787961600000,   // BHVR refreshes ~daily — dedup snapshots on this
  "ingestedAt": 1787996865721
}
```

Per-role fields (populated only with a real `matchCategory`):
- **survivors**: `totalHoursPlayed`, `totalMatchesPlayed`, `avgBPEarnedPerMatch`,
  `bpEarnedThroughMatch`, `escapeRate`, `matchesEscaped`, `survivorChasesWon`,
  `survivorLongestChaseTimeInSeconds`, `survivorSuccessfullyHealed`,
  `survivorTimesHooked`, `avgTimesHooked`, `emblems` (`{Emblem_*: {None|Bronze|Silver|Gold|Iridescent: count}}`)
- **killers**: same header fields + `avgHooks`, `avgKillRate`, `totalKills`,
  `totalHooks`, `totalHits`, `totalGenKicked`, `totalPalletsDestroyed`,
  `totalWallsBroken`, `totalChasesWon`, `emblems`
- **general**: hours / matches / BP totals only

EntityTrack polls all five categories each run and stores a `career_snapshots` row per
`(category, updatedAt)`; trends are `json_extract` over those rows.

### `GET /players/me`

Account profile: `{ accounts[], email, nickName, country, communicationLang, gameLibrary, ... }`.
The stable **player UUID is the `sub` claim of the access-token JWT**
(`f7917035-…`), not a top-level field. Useful later for SaaS multi-account scoping.

### `GET /players/me/game-accounts/dbd`

Linked provider accounts: `[ { provider, status, createdAt, updatedAt }, ... ]`.

### `GET /auth/flags` · `GET /campaigns`

Feature flags (`{ "communityStats": true }`) and marketing campaigns. No analytics value.

## Anomaly signatures for the Entity Corrector

From real captured matches:

- **Killer DC at load / lobby cancel** (fixture match 4, 46s): the DC'd player has
  `bloodpointsEarned: 0`, `postGameStat: {}`, `leaderboardScore: 0`, `playerTimeInMatch: -1`,
  **no** `platform`, **no** `emblems`, `playerStatus.id: "VE_Disconnected"`. Other players
  still earned BP (free escape). So "all players 0 BP" from the PRD is too strict — key on
  `playerTimeInMatch === -1` and/or the DC'd side's `bloodpointsEarned === 0`.
- **Surrender** (fixture matches 3 & the "SurrenderDraw" opponents): short duration,
  everyone's `playerStatus.id` is `VE_SurrenderLoss` / `VE_SurrenderDraw`.
- **Missing loadout**: a `characterLoadout` with empty `perks`/`addOns` and null
  `offering`/`power` on a player who otherwise played — candidate for the 15-min re-poll,
  though note the API may simply not expose an opponent's loadout in some modes.

## Reference data

Display names (`*.name`) and image paths come **inline** in every payload, localized by
`lang`. A separate id→name reference table is therefore optional. `server/src/reference/`
is still worth keeping for: canonical killer/perk grouping for analytics, a stable key when
`characterName.id` flips between legacy and coded forms, and offline image paths.

## Open follow-ups

1. Verify the `POST /sso/token` refresh request/response + rotation behaviour (watch the
   SPA do it).
2. Confirm whether match-history takes a game-mode filter param (all captured matches were
   `gameType.id: "Online"`; the site has 2v8 / Chaos Shuffle / Lights Out tabs).
3. Confirm behaviour around `isCustomMatch: true` and special events (`specialEventId != "NONE"`).

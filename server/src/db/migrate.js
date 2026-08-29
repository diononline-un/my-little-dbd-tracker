/**
 * Schema definition, as idempotent DDL. Node's built-in SQLite has no migration
 * tooling and this is a forward-only single-file DB, so the canonical schema
 * lives here and is applied on every boot (see db/index.js).
 *
 * Columns storing timestamps hold epoch milliseconds (INTEGER).
 * Columns storing JSON hold TEXT (json_extract / json_each work on them).
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS raw_payloads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint      TEXT    NOT NULL,
  fetched_at    INTEGER NOT NULL,
  http_status   INTEGER NOT NULL,
  body          TEXT    NOT NULL,
  payload_hash  TEXT    NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS raw_payloads_endpoint_idx   ON raw_payloads (endpoint);
CREATE INDEX IF NOT EXISTS raw_payloads_fetched_at_idx ON raw_payloads (fetched_at);

CREATE TABLE IF NOT EXISTS matches (
  match_id          TEXT    PRIMARY KEY,   -- synthetic: String(matchStartTime)
  played_at         INTEGER,
  game_mode         TEXT,
  self_role         TEXT,                  -- 'survivor' | 'killer'
  is_custom_match   INTEGER NOT NULL DEFAULT 0,
  special_event_id  TEXT,
  map_id            TEXT,
  map_name          TEXT,
  duration_seconds  INTEGER,
  killer_id         TEXT,
  killer_name       TEXT,
  outcome           TEXT,                  -- self-perspective; 'canceled' excluded from rates
  self_grade        TEXT,                  -- killer matches only
  self_kills        INTEGER,               -- killer matches: survivors dead/sacrificed
  self_escaped      INTEGER,               -- survivor matches: 1/0
  self_bloodpoints  INTEGER,
  emblems           TEXT,                  -- JSON [{ emblem_id, emblem_name, emblem_quality }]
  is_corrected      INTEGER NOT NULL DEFAULT 0,
  correction_notes  TEXT    NOT NULL DEFAULT '[]',  -- JSON [{ rule, reason, before, after }]
  raw_payload_id    INTEGER REFERENCES raw_payloads (id),
  repoll_after      INTEGER,               -- epoch ms; set by the missing-loadout rule
  repoll_attempts   INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS matches_played_at_idx ON matches (played_at);
CREATE INDEX IF NOT EXISTS matches_killer_idx    ON matches (killer_id);
CREATE INDEX IF NOT EXISTS matches_map_idx       ON matches (map_id);
CREATE INDEX IF NOT EXISTS matches_repoll_idx    ON matches (repoll_after);
CREATE INDEX IF NOT EXISTS matches_outcome_idx   ON matches (outcome);

CREATE TABLE IF NOT EXISTS match_players (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id       TEXT    NOT NULL REFERENCES matches (match_id) ON DELETE CASCADE,
  slot           INTEGER NOT NULL,         -- 0 = self, 1..4 = opponents
  role           TEXT    NOT NULL,
  character_id   TEXT,
  character_name TEXT,
  prestige       INTEGER,
  time_in_match  INTEGER,                  -- seconds; -1 = never loaded in
  bloodpoints    INTEGER,
  emblems        TEXT,                     -- JSON
  perks          TEXT,                     -- JSON [{ id, name }]
  addons         TEXT,                     -- JSON [{ id, name }]
  offering_id    TEXT,
  offering_name  TEXT,
  power_id       TEXT,
  power_name     TEXT,
  status         TEXT,                     -- escaped|died|sacrificed|dc|ragequit|surrender_loss|surrender_draw|killer_grade
  killer_grade   TEXT,
  is_self        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS match_players_match_idx     ON match_players (match_id);
CREATE INDEX IF NOT EXISTS match_players_character_idx ON match_players (character_id);

CREATE TABLE IF NOT EXISTS sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at INTEGER NOT NULL
);
`;

// Allow `node src/db/migrate.js` to bootstrap a DB without starting the server.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { db } = await import('./index.js');
  db.exec(DDL);
  console.log('[migrate] schema is up to date');
}

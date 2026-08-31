import { createHash } from 'node:crypto';
import { db, toMs, fromMs, bool } from './db/index.js';

export function hashPayload(body) {
  return createHash('sha256').update(body).digest('hex');
}

const j = (v) => (v == null ? null : JSON.stringify(v));
const parse = (s, fallback = null) => {
  if (s == null) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};

// ---------------------------------------------------------------- raw payloads

const insRaw = db.prepare(
  `INSERT INTO raw_payloads (endpoint, fetched_at, http_status, body, payload_hash)
   VALUES (?, ?, ?, ?, ?)`,
);
const selRawByHash = db.prepare('SELECT id FROM raw_payloads WHERE payload_hash = ?');

/** Store a raw payload verbatim; dedup on sha256(body). */
export function storeRawPayload({ endpoint, fetchedAt, httpStatus, body }) {
  const payloadHash = hashPayload(body);
  const existing = selRawByHash.get(payloadHash);
  if (existing) return { id: Number(existing.id), deduped: true };
  const info = insRaw.run(endpoint, toMs(fetchedAt), httpStatus, body, payloadHash);
  return { id: Number(info.lastInsertRowid), deduped: false };
}

// --------------------------------------------------------------------- matches

const selMatch = db.prepare('SELECT * FROM matches WHERE match_id = ?');
const selPlayers = db.prepare(
  'SELECT * FROM match_players WHERE match_id = ? ORDER BY slot',
);

const upsertMatchStmt = db.prepare(`
  INSERT INTO matches (
    match_id, played_at, game_mode, self_role, is_custom_match, special_event_id,
    map_id, map_name, duration_seconds, killer_id, killer_name, outcome, self_grade,
    self_kills, self_escaped, self_bloodpoints, emblems, is_corrected, correction_notes,
    raw_payload_id, repoll_after, repoll_attempts, created_at, updated_at
  ) VALUES (
    :match_id, :played_at, :game_mode, :self_role, :is_custom_match, :special_event_id,
    :map_id, :map_name, :duration_seconds, :killer_id, :killer_name, :outcome, :self_grade,
    :self_kills, :self_escaped, :self_bloodpoints, :emblems, :is_corrected, :correction_notes,
    :raw_payload_id, :repoll_after, :repoll_attempts, :created_at, :updated_at
  )
  ON CONFLICT (match_id) DO UPDATE SET
    played_at = excluded.played_at, game_mode = excluded.game_mode,
    self_role = excluded.self_role, is_custom_match = excluded.is_custom_match,
    special_event_id = excluded.special_event_id, map_id = excluded.map_id,
    map_name = excluded.map_name, duration_seconds = excluded.duration_seconds,
    killer_id = excluded.killer_id, killer_name = excluded.killer_name,
    outcome = excluded.outcome, self_grade = excluded.self_grade,
    self_kills = excluded.self_kills, self_escaped = excluded.self_escaped,
    self_bloodpoints = excluded.self_bloodpoints, emblems = excluded.emblems,
    is_corrected = excluded.is_corrected, correction_notes = excluded.correction_notes,
    raw_payload_id = excluded.raw_payload_id, repoll_after = excluded.repoll_after,
    updated_at = excluded.updated_at
`);

const delPlayers = db.prepare('DELETE FROM match_players WHERE match_id = ?');
const insPlayer = db.prepare(`
  INSERT INTO match_players (
    match_id, slot, role, character_id, character_name, prestige, character_level, platform,
    time_in_match, bloodpoints, leaderboard_score, post_game_stat, emblems, perks,
    addons, offering_id, offering_name, power_id, power_name, status, killer_grade, is_self
  ) VALUES (
    :match_id, :slot, :role, :character_id, :character_name, :prestige, :character_level, :platform,
    :time_in_match, :bloodpoints, :leaderboard_score, :post_game_stat, :emblems, :perks,
    :addons, :offering_id, :offering_name, :power_id, :power_name, :status, :killer_grade, :is_self
  )
`);

/** Upsert a normalized match + rewrite its player rows. */
export function saveNormalizedMatch({ match, players }, rawPayloadId) {
  const now = Date.now();
  db.exec('BEGIN');
  try {
    const prior = selMatch.get(match.matchId);
    upsertMatchStmt.run({
      match_id: match.matchId,
      played_at: toMs(match.playedAt),
      game_mode: match.gameMode ?? null,
      self_role: match.selfRole ?? null,
      is_custom_match: bool(match.isCustomMatch) ?? 0,
      special_event_id: match.specialEventId ?? null,
      map_id: match.mapId ?? null,
      map_name: match.mapName ?? null,
      duration_seconds: match.durationSeconds ?? null,
      killer_id: match.killerId ?? null,
      killer_name: match.killerName ?? null,
      outcome: match.outcome ?? null,
      self_grade: match.selfGrade ?? null,
      self_kills: match.selfKills ?? null,
      self_escaped: bool(match.selfEscaped),
      self_bloodpoints: match.selfBloodpoints ?? null,
      emblems: j(match.emblems),
      is_corrected: bool(match.isCorrected) ?? 0,
      correction_notes: j(match.correctionNotes ?? []),
      raw_payload_id: rawPayloadId ?? null,
      repoll_after: toMs(match.repollAfter),
      repoll_attempts: prior?.repoll_attempts ?? 0,
      created_at: prior?.created_at ?? now,
      updated_at: now,
    });

    delPlayers.run(match.matchId);
    for (const p of players) {
      insPlayer.run({
        match_id: match.matchId,
        slot: p.slot,
        role: p.role,
        character_id: p.characterId ?? null,
        character_name: p.characterName ?? null,
        prestige: p.prestige ?? null,
        character_level: p.characterLevel ?? null,
        platform: p.platform ?? null,
        time_in_match: p.timeInMatch ?? null,
        bloodpoints: p.bloodpoints ?? null,
        leaderboard_score: p.leaderboardScore ?? null,
        post_game_stat: j(p.postGameStat ?? null),
        emblems: j(p.emblems ?? []),
        perks: j(p.perks ?? []),
        addons: j(p.addons ?? []),
        offering_id: p.offeringId ?? null,
        offering_name: p.offeringName ?? null,
        power_id: p.powerId ?? null,
        power_name: p.powerName ?? null,
        status: p.status ?? null,
        killer_grade: p.killerGrade ?? null,
        is_self: bool(p.isSelf) ?? 0,
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const bumpRepoll = db.prepare(
  'UPDATE matches SET repoll_attempts = repoll_attempts + 1, updated_at = ? WHERE match_id = ?',
);
export function bumpRepollAttempt(matchId) {
  bumpRepoll.run(Date.now(), matchId);
}

const clearRepollStmt = db.prepare(
  'UPDATE matches SET repoll_after = NULL, updated_at = ? WHERE match_id = ?',
);
export function clearRepoll(matchId) {
  clearRepollStmt.run(Date.now(), matchId);
}

const selDueRepolls = db.prepare(`
  SELECT match_id, repoll_attempts FROM matches
  WHERE repoll_after IS NOT NULL AND repoll_after <= :now AND repoll_attempts < :max
  ORDER BY repoll_after
`);
export function dueRepolls(maxAttempts, now = new Date()) {
  return selDueRepolls
    .all({ now: toMs(now), max: maxAttempts })
    .map((r) => ({ matchId: r.match_id, attempts: r.repoll_attempts }));
}

/** Full match with hydrated player rows and parsed JSON. */
export function getMatch(matchId) {
  const m = selMatch.get(matchId);
  if (!m) return null;
  return {
    ...m,
    playedAt: fromMs(m.played_at),
    isCorrected: Boolean(m.is_corrected),
    selfRole: m.self_role,
    repollAfter: fromMs(m.repoll_after),
    repollAttempts: m.repoll_attempts,
    emblems: parse(m.emblems, []),
    correctionNotes: parse(m.correction_notes, []),
    players: selPlayers.all(matchId).map((p) => ({
      ...p,
      isSelf: Boolean(p.is_self),
      emblems: parse(p.emblems, []),
      perks: parse(p.perks, []),
      addons: parse(p.addons, []),
      post_game_stat: parse(p.post_game_stat, null),
    })),
  };
}

// ------------------------------------------------------------- career snapshots

const insCareer = db.prepare(`
  INSERT INTO career_snapshots
    (captured_at, category, bhvr_updated_at, bhvr_ingested_at, payload, raw_payload_id)
  VALUES (:captured_at, :category, :bhvr_updated_at, :bhvr_ingested_at, :payload, :raw_payload_id)
  ON CONFLICT (category, bhvr_updated_at) DO NOTHING
`);

/** Store one career snapshot; no-op if we already have this (category, updatedAt). */
export function storeCareerSnapshot({ category, bhvrUpdatedAt, bhvrIngestedAt, data }, rawPayloadId) {
  const info = insCareer.run({
    captured_at: Date.now(),
    category,
    bhvr_updated_at: bhvrUpdatedAt ?? null,
    bhvr_ingested_at: bhvrIngestedAt ?? null,
    payload: JSON.stringify(data),
    raw_payload_id: rawPayloadId ?? null,
  });
  return { inserted: info.changes > 0 };
}

const selLatestCareer = db.prepare(`
  SELECT * FROM career_snapshots WHERE category = ?
  ORDER BY bhvr_updated_at DESC, captured_at DESC LIMIT 1
`);
const selCareerCategories = db.prepare(
  'SELECT DISTINCT category FROM career_snapshots ORDER BY category',
);

export function latestCareer(category) {
  const row = selLatestCareer.get(category);
  if (!row) return null;
  return { ...row, payload: parse(row.payload, null) };
}

export function careerCategories() {
  return selCareerCategories.all().map((r) => r.category);
}

/**
 * Time series of one metric for a (category, window, role), one point per stored
 * snapshot. `metricPath` is a JSON path segment like 'survivors.escapeRate'.
 */
export function careerTrend(category, window, metricPath) {
  const jsonPath = `$."${window}".global.${metricPath
    .split('.')
    .map((s) => `"${s}"`)
    .join('.')}`;
  return db
    .prepare(
      `SELECT captured_at, bhvr_updated_at AS t,
              json_extract(payload, ?) AS value
       FROM career_snapshots
       WHERE category = ?
       GROUP BY bhvr_updated_at
       ORDER BY bhvr_updated_at`,
    )
    .all(jsonPath, category)
    .filter((r) => r.value != null)
    .map((r) => ({ t: r.t ?? r.captured_at, value: r.value }));
}

// ------------------------------------------------------------------ sync state

const selSync = db.prepare('SELECT value FROM sync_state WHERE key = ?');
const upSync = db.prepare(`
  INSERT INTO sync_state (key, value, updated_at) VALUES (:key, :value, :now)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
export function getSyncState(key) {
  return parse(selSync.get(key)?.value ?? null);
}
export function setSyncState(key, value) {
  upSync.run({ key, value: j(value), now: Date.now() });
}

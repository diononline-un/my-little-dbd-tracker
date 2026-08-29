/**
 * Read-side analytics. Raw SQL against the sqlite handle — group-bys and JSON
 * extraction are clearer here than through the ORM. Everything that computes a
 * rate excludes canceled matches (outcome = 'canceled').
 *
 * "Win" definitions:
 *   survivor  -> self_escaped = 1  (escape, incl. surrender-draw)
 *   killer    -> self_kills >= 3   (2+ hooks convention: 3K/4K = win)
 */
import { db as sqlite } from './db/index.js';

const NOT_CANCELED = `outcome IS NOT 'canceled'`;

export function summary() {
  const row = sqlite
    .prepare(
      `SELECT
         COUNT(*)                                             AS total,
         SUM(CASE WHEN outcome = 'canceled' THEN 1 ELSE 0 END) AS canceled,
         SUM(CASE WHEN is_corrected THEN 1 ELSE 0 END)         AS corrected,
         SUM(CASE WHEN self_role = 'survivor' THEN 1 ELSE 0 END) AS survivor_matches,
         SUM(CASE WHEN self_role = 'killer'   THEN 1 ELSE 0 END) AS killer_matches,
         SUM(self_bloodpoints)                                AS total_bp
       FROM matches`,
    )
    .get();

  const surv = sqlite
    .prepare(
      `SELECT
         COUNT(*) AS n,
         SUM(CASE WHEN self_escaped THEN 1 ELSE 0 END) AS escapes
       FROM matches WHERE self_role = 'survivor' AND ${NOT_CANCELED}`,
    )
    .get();

  const kill = sqlite
    .prepare(
      `SELECT
         COUNT(*) AS n,
         SUM(CASE WHEN self_kills >= 3 THEN 1 ELSE 0 END) AS wins,
         AVG(self_kills) AS avg_kills
       FROM matches WHERE self_role = 'killer' AND ${NOT_CANCELED}`,
    )
    .get();

  return {
    totalMatches: row.total ?? 0,
    canceledMatches: row.canceled ?? 0,
    correctedMatches: row.corrected ?? 0,
    totalBloodpoints: row.total_bp ?? 0,
    survivor: {
      matches: surv.n ?? 0,
      escapes: surv.escapes ?? 0,
      escapeRate: surv.n ? (surv.escapes ?? 0) / surv.n : null,
    },
    killer: {
      matches: kill.n ?? 0,
      wins: kill.wins ?? 0,
      winRate: kill.n ? (kill.wins ?? 0) / kill.n : null,
      avgKills: kill.avg_kills ?? null,
    },
  };
}

export function listMatches(filters = {}) {
  const { role, killerId, mapId, corrected, from, to } = filters;
  const limit = Math.min(Number(filters.limit) || 50, 200);
  const offset = Number(filters.offset) || 0;

  const where = [];
  const params = {};
  if (role) { where.push('self_role = :role'); params.role = role; }
  if (killerId) { where.push('killer_id = :killerId'); params.killerId = killerId; }
  if (mapId) { where.push('map_id = :mapId'); params.mapId = mapId; }
  if (corrected != null) { where.push('is_corrected = :corrected'); params.corrected = corrected ? 1 : 0; }
  if (from) { where.push('played_at >= :from'); params.from = Number(from); }
  if (to) { where.push('played_at <= :to'); params.to = Number(to); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = sqlite
    .prepare(`SELECT COUNT(*) AS n FROM matches ${clause}`)
    .get(params).n;

  const rows = sqlite
    .prepare(
      `SELECT match_id, played_at, game_mode, self_role, map_id, map_name,
              duration_seconds, killer_id, killer_name, outcome, self_grade,
              self_kills, self_escaped, self_bloodpoints, is_corrected, correction_notes,
              repoll_after
       FROM matches ${clause}
       ORDER BY played_at DESC
       LIMIT :limit OFFSET :offset`,
    )
    .all({ ...params, limit, offset });

  return { total, limit, offset, matches: rows.map(hydrateMatchRow) };
}

function hydrateMatchRow(r) {
  return {
    ...r,
    is_corrected: Boolean(r.is_corrected),
    self_escaped: r.self_escaped == null ? null : Boolean(r.self_escaped),
    correction_notes: safeJson(r.correction_notes, []),
  };
}

function safeJson(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

/**
 * Survival/win rate vs each killer the player faced as survivor. Optionally
 * filtered to matches where the player ran a given perk / on a given map.
 */
export function killerAnalytics({ mapId, selfPerkId } = {}) {
  const joins = [];
  const where = [`m.self_role = 'survivor'`, `m.${NOT_CANCELED}`];
  const params = {};
  if (mapId) { where.push('m.map_id = :mapId'); params.mapId = mapId; }
  if (selfPerkId) {
    joins.push(`JOIN match_players sp
      ON sp.match_id = m.match_id AND sp.is_self = 1
     AND EXISTS (SELECT 1 FROM json_each(sp.perks) je
                 WHERE json_extract(je.value, '$.id') = :selfPerkId)`);
    params.selfPerkId = selfPerkId;
  }

  return sqlite
    .prepare(
      `SELECT m.killer_id, m.killer_name,
              COUNT(*) AS matches,
              SUM(CASE WHEN m.self_escaped THEN 1 ELSE 0 END) AS escapes
       FROM matches m
       ${joins.join('\n')}
       WHERE ${where.join(' AND ')}
       GROUP BY m.killer_id
       ORDER BY matches DESC`,
    )
    .all(params)
    .map((r) => ({
      killerId: r.killer_id,
      killerName: r.killer_name,
      matches: r.matches,
      escapes: r.escapes,
      escapeRate: r.matches ? r.escapes / r.matches : null,
    }));
}

/** Escape rate by the player's own perk (survivor matches). */
export function buildAnalytics({ minMatches = 3 } = {}) {
  return sqlite
    .prepare(
      `SELECT json_extract(je.value, '$.id')   AS perk_id,
              json_extract(je.value, '$.name') AS perk_name,
              COUNT(*)                          AS matches,
              SUM(CASE WHEN m.self_escaped THEN 1 ELSE 0 END) AS escapes
       FROM matches m
       JOIN match_players sp ON sp.match_id = m.match_id AND sp.is_self = 1
       JOIN json_each(sp.perks) je
       WHERE m.self_role = 'survivor' AND m.${NOT_CANCELED}
       GROUP BY perk_id
       HAVING matches >= :minMatches
       ORDER BY escapes * 1.0 / matches DESC`,
    )
    .all({ minMatches })
    .map((r) => ({
      perkId: r.perk_id,
      perkName: r.perk_name,
      matches: r.matches,
      escapes: r.escapes,
      escapeRate: r.matches ? r.escapes / r.matches : null,
    }));
}

/** Escape rate by a random teammate's perk (solo-queue signal). */
export function teammateAnalytics({ minMatches = 3 } = {}) {
  return sqlite
    .prepare(
      `SELECT json_extract(je.value, '$.id')   AS perk_id,
              json_extract(je.value, '$.name') AS perk_name,
              COUNT(DISTINCT m.match_id)        AS matches,
              SUM(CASE WHEN m.self_escaped THEN 1 ELSE 0 END) AS escapes_when_present
       FROM matches m
       JOIN match_players tp
         ON tp.match_id = m.match_id AND tp.is_self = 0 AND tp.role = 'survivor'
       JOIN json_each(tp.perks) je
       WHERE m.self_role = 'survivor' AND m.${NOT_CANCELED}
       GROUP BY perk_id
       HAVING matches >= :minMatches
       ORDER BY matches DESC`,
    )
    .all({ minMatches })
    .map((r) => ({
      perkId: r.perk_id,
      perkName: r.perk_name,
      matches: r.matches,
      selfEscapesWhenPresent: r.escapes_when_present,
      selfEscapeRateWhenPresent: r.matches ? r.escapes_when_present / r.matches : null,
    }));
}

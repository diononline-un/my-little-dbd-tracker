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

  // self loadout + opponent thumbnails for the returned page, two batched queries
  const ids = rows.map((r) => r.match_id);
  const selfByMatch = {};
  const oppByMatch = {};
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    for (const p of sqlite
      .prepare(
        `SELECT match_id, role, character_id, character_name, prestige, leaderboard_score,
                perks, addons, offering_id, offering_name, power_id, power_name,
                post_game_stat, emblems
         FROM match_players WHERE is_self = 1 AND match_id IN (${ph})`,
      )
      .all(...ids)) {
      const emblems = safeJson(p.emblems, []);
      selfByMatch[p.match_id] = {
        role: p.role,
        character_id: p.character_id,
        character_name: p.character_name,
        prestige: p.prestige,
        leaderboardScore: p.leaderboard_score,
        perks: safeJson(p.perks, []),
        addons: safeJson(p.addons, []),
        offering_id: p.offering_id,
        offering_name: p.offering_name,
        power_id: p.power_id,
        power_name: p.power_name,
        post_game_stat: safeJson(p.post_game_stat, null),
        emblems,
        emblemScore: emblemSum(emblems),
      };
    }
    for (const p of sqlite
      .prepare(
        `SELECT match_id, slot, role, character_id, character_name, prestige, bloodpoints,
                leaderboard_score, status, killer_grade, perks, addons, offering_id,
                offering_name, power_id, power_name, post_game_stat, emblems
         FROM match_players WHERE is_self = 0 AND match_id IN (${ph}) ORDER BY slot`,
      )
      .all(...ids)) {
      (oppByMatch[p.match_id] ??= []).push({
        role: p.role,
        character_id: p.character_id,
        character_name: p.character_name,
        prestige: p.prestige,
        bloodpoints: p.bloodpoints,
        leaderboardScore: p.leaderboard_score,
        status: p.status,
        killer_grade: p.killer_grade,
        perks: safeJson(p.perks, []),
        addons: safeJson(p.addons, []),
        offering_id: p.offering_id,
        offering_name: p.offering_name,
        power_id: p.power_id,
        power_name: p.power_name,
        post_game_stat: safeJson(p.post_game_stat, null),
        emblemScore: emblemSum(safeJson(p.emblems, [])),
      });
    }
  }

  return {
    total,
    limit,
    offset,
    matches: rows.map((r) =>
      hydrateMatchRow(r, selfByMatch[r.match_id], oppByMatch[r.match_id] ?? []),
    ),
  };
}

function hydrateMatchRow(r, self, opponents = []) {
  // survivors first, killer last — matches the official card ordering
  const ordered = [...opponents].sort((a, b) => (a.role === 'killer') - (b.role === 'killer'));
  return {
    ...r,
    is_corrected: Boolean(r.is_corrected),
    self_escaped: r.self_escaped == null ? null : Boolean(r.self_escaped),
    correction_notes: safeJson(r.correction_notes, []),
    self: self ?? null,
    opponents: ordered,
  };
}

function safeJson(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

// Derived "emblem score" (0–16): BHVR exposes no pips/grade, but the 4 emblem
// qualities per match historically drove pip gain. None=0 … Iridescent=4.
const EMBLEM_Q = { None: 0, Bronze: 1, Silver: 2, Gold: 3, Iridescent: 4 };
function emblemSum(emblems) {
  if (!Array.isArray(emblems) || !emblems.length) return null;
  return emblems.reduce((a, e) => a + (EMBLEM_Q[e.emblem_quality] ?? 0), 0);
}
export { emblemSum };

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

/**
 * Per-map performance. Survivor rows show escape rate; killer rows show 3K+ win
 * rate and avg kills. Canceled matches excluded.
 */
export function mapAnalytics({ role } = {}) {
  const where = [`m.${NOT_CANCELED}`, 'm.map_id IS NOT NULL'];
  const params = {};
  if (role) { where.push('m.self_role = :role'); params.role = role; }
  return sqlite
    .prepare(
      `SELECT map_id, map_name, self_role,
              COUNT(*) AS matches,
              SUM(CASE WHEN self_escaped THEN 1 ELSE 0 END) AS escapes,
              SUM(CASE WHEN self_kills >= 3 THEN 1 ELSE 0 END) AS killer_wins,
              AVG(self_kills) AS avg_kills,
              AVG(self_bloodpoints) AS avg_bp
       FROM matches m
       WHERE ${where.join(' AND ')}
       GROUP BY map_id, self_role
       ORDER BY matches DESC`,
    )
    .all(params)
    .map((r) => ({
      mapId: r.map_id,
      mapName: r.map_name,
      role: r.self_role,
      matches: r.matches,
      escapeRate: r.self_role === 'survivor' && r.matches ? r.escapes / r.matches : null,
      killerWinRate: r.self_role === 'killer' && r.matches ? r.killer_wins / r.matches : null,
      avgKills: r.self_role === 'killer' ? r.avg_kills : null,
      avgBloodpoints: r.avg_bp,
    }));
}

/** How the player does with each killer THEY play (killer matches). */
export function selfKillerAnalytics() {
  return sqlite
    .prepare(
      `SELECT killer_id, killer_name,
              COUNT(*) AS matches,
              SUM(CASE WHEN self_kills >= 3 THEN 1 ELSE 0 END) AS wins,
              AVG(self_kills) AS avg_kills,
              AVG(self_bloodpoints) AS avg_bp
       FROM matches
       WHERE self_role = 'killer' AND ${NOT_CANCELED} AND killer_id IS NOT NULL
       GROUP BY killer_id
       ORDER BY matches DESC`,
    )
    .all()
    .map((r) => ({
      killerId: r.killer_id,
      killerName: r.killer_name,
      matches: r.matches,
      winRate: r.matches ? r.wins / r.matches : null,
      avgKills: r.avg_kills,
      avgBloodpoints: r.avg_bp,
    }));
}

/** Escape/win rate by the player's own offering. */
export function offeringAnalytics({ minMatches = 3 } = {}) {
  return sqlite
    .prepare(
      `SELECT sp.offering_id, sp.offering_name, m.self_role,
              COUNT(*) AS matches,
              SUM(CASE WHEN m.self_escaped THEN 1 ELSE 0 END) AS escapes,
              SUM(CASE WHEN m.self_kills >= 3 THEN 1 ELSE 0 END) AS wins
       FROM matches m
       JOIN match_players sp ON sp.match_id = m.match_id AND sp.is_self = 1
       WHERE m.${NOT_CANCELED} AND sp.offering_id IS NOT NULL
       GROUP BY sp.offering_id, m.self_role
       HAVING matches >= :minMatches
       ORDER BY matches DESC`,
    )
    .all({ minMatches })
    .map((r) => ({
      offeringId: r.offering_id,
      offeringName: r.offering_name,
      role: r.self_role,
      matches: r.matches,
      rate: r.matches
        ? (r.self_role === 'survivor' ? r.escapes : r.wins) / r.matches
        : null,
    }));
}

/** Escape rate for pairs of the player's own perks (survivor). */
export function perkPairAnalytics({ minMatches = 3 } = {}) {
  return sqlite
    .prepare(
      `SELECT json_extract(a.value, '$.id') AS perk_a_id,
              json_extract(a.value, '$.name') AS perk_a,
              json_extract(b.value, '$.id') AS perk_b_id,
              json_extract(b.value, '$.name') AS perk_b,
              COUNT(*) AS matches,
              SUM(CASE WHEN m.self_escaped THEN 1 ELSE 0 END) AS escapes
       FROM matches m
       JOIN match_players sp ON sp.match_id = m.match_id AND sp.is_self = 1
       JOIN json_each(sp.perks) a
       JOIN json_each(sp.perks) b
         ON json_extract(a.value, '$.id') < json_extract(b.value, '$.id')
       WHERE m.self_role = 'survivor' AND m.${NOT_CANCELED}
       GROUP BY perk_a_id, perk_b_id
       HAVING matches >= :minMatches
       ORDER BY escapes * 1.0 / matches DESC, matches DESC`,
    )
    .all({ minMatches })
    .map((r) => ({
      perks: [
        { id: r.perk_a_id, name: r.perk_a },
        { id: r.perk_b_id, name: r.perk_b },
      ],
      matches: r.matches,
      escapes: r.escapes,
      escapeRate: r.matches ? r.escapes / r.matches : null,
    }));
}

// --------------------------------------------------------------- streaks / form

/** A match "won" from the self perspective (canceled matches are neutral, skipped). */
const wonExpr = (t = '') => {
  const p = t ? `${t}.` : '';
  return `CASE
    WHEN ${p}outcome = 'canceled' THEN NULL
    WHEN ${p}self_role = 'survivor' THEN (${p}self_escaped = 1)
    WHEN ${p}self_role = 'killer'   THEN (${p}self_kills >= 3)
    ELSE NULL END`;
};
const WON_EXPR = wonExpr();

function streakFor(where = '1=1') {
  const rows = sqlite
    .prepare(
      `SELECT ${WON_EXPR} AS won, played_at
       FROM matches
       WHERE outcome IS NOT 'canceled' AND ${where}
       ORDER BY played_at DESC`,
    )
    .all()
    .filter((r) => r.won != null);

  if (!rows.length) return { current: 0, currentType: null, best: 0, bestType: null, worst: 0 };

  // current streak: run from the most recent match
  const head = rows[0].won;
  let current = 0;
  for (const r of rows) {
    if (Boolean(r.won) === Boolean(head)) current += 1;
    else break;
  }

  // best win streak + worst losing streak over all history
  let best = 0, worst = 0, run = 0, runWon = null;
  for (const r of rows) {
    const w = Boolean(r.won);
    if (w === runWon) run += 1;
    else { run = 1; runWon = w; }
    if (w && run > best) best = run;
    if (!w && run > worst) worst = run;
  }

  return {
    current,
    currentType: head ? 'win' : 'loss',
    best,
    bestType: 'win',
    worst,
  };
}

export function streaks() {
  return {
    overall: streakFor(),
    survivor: streakFor(`self_role = 'survivor'`),
    killer: streakFor(`self_role = 'killer'`),
  };
}

/** Last N decided matches, newest first — for a W/L strip + rolling rate. */
export function recentForm({ limit = 20 } = {}) {
  const rows = sqlite
    .prepare(
      `SELECT match_id, played_at, self_role, outcome, killer_name, map_name,
              ${WON_EXPR} AS won
       FROM matches
       WHERE outcome IS NOT 'canceled'
       ORDER BY played_at DESC
       LIMIT :limit`,
    )
    .all({ limit })
    .filter((r) => r.won != null)
    .map((r) => ({ ...r, won: Boolean(r.won) }));

  const wins = rows.filter((r) => r.won).length;
  return { matches: rows, wins, losses: rows.length - wins, rate: rows.length ? wins / rows.length : null };
}

/** current + best/worst run stats from a newest-first array of win booleans. */
function runStats(newestFirstBools) {
  if (!newestFirstBools.length) return { current: 0, currentType: null, best: 0, worst: 0 };
  const head = newestFirstBools[0];
  let current = 0;
  for (const w of newestFirstBools) { if (w === head) current += 1; else break; }
  let best = 0, worst = 0, run = 0, prev = null;
  for (const w of newestFirstBools) {
    if (w === prev) run += 1; else { run = 1; prev = w; }
    if (w && run > best) best = run;
    if (!w && run > worst) worst = run;
  }
  return { current, currentType: head ? 'win' : 'loss', best, worst };
}

/**
 * Win streaks bucketed by the self character (killer you play OR survivor you play).
 * Returns { killers: [...], survivors: [...], records } — each entry
 * { characterId, characterName, role, current, currentType, best, worst, matches, lastPlayedAt }.
 */
export function characterStreaks() {
  const rows = sqlite
    .prepare(
      `SELECT m.played_at, m.self_role,
              CASE WHEN m.self_role = 'killer' THEN m.killer_id ELSE sp.character_id END AS char_id,
              CASE WHEN m.self_role = 'killer' THEN m.killer_name ELSE sp.character_name END AS char_name,
              ${wonExpr('m')} AS won
       FROM matches m
       JOIN match_players sp ON sp.match_id = m.match_id AND sp.is_self = 1
       WHERE m.outcome IS NOT 'canceled'
       ORDER BY m.played_at DESC`,
    )
    .all()
    .filter((r) => r.won != null && r.char_id);

  const buckets = new Map(); // key: role|charId
  for (const r of rows) {
    const key = `${r.self_role}|${r.char_id}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        characterId: r.char_id, characterName: r.char_name, role: r.self_role,
        bools: [], matches: 0, lastPlayedAt: r.played_at,
      });
    }
    const b = buckets.get(key);
    b.bools.push(Boolean(r.won));
    b.matches += 1;
  }

  const entries = [...buckets.values()].map((b) => {
    const { bools, ...rest } = b;
    return { ...rest, ...runStats(bools) };
  });
  const bySide = (role) =>
    entries.filter((e) => e.role === role).sort((a, b) => b.best - a.best || b.matches - a.matches);

  const killers = bySide('killer');
  const survivors = bySide('survivor');
  const topOf = (arr) => arr.slice().sort((a, b) => b.best - a.best)[0] ?? null;

  return {
    killers,
    survivors,
    records: {
      killer: topOf(killers),
      survivor: topOf(survivors),
      overall: [topOf(killers), topOf(survivors)].filter(Boolean).sort((a, b) => b.best - a.best)[0] ?? null,
    },
  };
}

/**
 * Group matches into play sessions — a gap larger than `gapMinutes` starts a new one.
 * Newest session first.
 */
export function sessions({ gapMinutes = 45 } = {}) {
  const rows = sqlite
    .prepare(
      `SELECT match_id, played_at, self_role, self_bloodpoints,
              ${WON_EXPR} AS won
       FROM matches
       ORDER BY played_at ASC`,
    )
    .all();

  const gap = gapMinutes * 60_000;
  const out = [];
  let cur = null;
  for (const r of rows) {
    if (!cur || r.played_at - cur.end > gap) {
      cur = { start: r.played_at, end: r.played_at, count: 0, wins: 0, losses: 0,
              bp: 0, roles: new Set(), bools: [], matchIds: [] };
      out.push(cur);
    }
    cur.end = r.played_at;
    cur.count += 1;
    cur.bp += r.self_bloodpoints ?? 0;
    cur.roles.add(r.self_role);
    cur.matchIds.push(r.match_id);
    if (r.won != null) {
      cur.bools.push(Boolean(r.won));
      if (r.won) cur.wins += 1; else cur.losses += 1;
    }
  }

  return out
    .map((s) => ({
      start: s.start, end: s.end, durationMinutes: Math.round((s.end - s.start) / 60_000),
      count: s.count, wins: s.wins, losses: s.losses, bp: s.bp,
      roles: [...s.roles],
      bestStreak: runStats(s.bools.slice().reverse()).best,
      matchIds: s.matchIds,
    }))
    .reverse();
}

/** One week's aggregate vs the prior week. offset 0 = the last 7 days. */
function weekAgg(offset, now = Date.now()) {
  const hi = now - offset * 7 * 86_400_000;
  const lo = hi - 7 * 86_400_000;

  const rows = sqlite
    .prepare(
      `SELECT m.played_at, m.self_role, m.self_bloodpoints, m.killer_id, m.killer_name,
              ${wonExpr('m')} AS won,
              sp.perks AS self_perks, sp.character_name AS self_char
       FROM matches m
       JOIN match_players sp ON sp.match_id = m.match_id AND sp.is_self = 1
       WHERE m.played_at >= :lo AND m.played_at < :hi AND m.outcome IS NOT 'canceled'
       ORDER BY m.played_at DESC`,
    )
    .all({ lo, hi });

  const decided = rows.filter((r) => r.won != null);
  const wins = decided.filter((r) => r.won).length;
  const bp = rows.reduce((a, r) => a + (r.self_bloodpoints ?? 0), 0);

  const count = (fn) => {
    const m = new Map();
    for (const r of rows) { const k = fn(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const perkTally = new Map();
  for (const r of rows) {
    for (const p of safeJson(r.self_perks, [])) {
      if (p?.name) perkTally.set(p.name, (perkTally.get(p.name) ?? 0) + 1);
    }
  }

  return {
    from: lo, to: hi,
    matches: rows.length,
    wins, losses: decided.length - wins,
    winRate: decided.length ? wins / decided.length : null,
    bp, avgBp: rows.length ? Math.round(bp / rows.length) : 0,
    bestStreak: runStats(decided.map((r) => Boolean(r.won))).best,
    mostPlayedKiller: count((r) => (r.self_role === 'killer' ? r.self_char : null)),
    mostFacedKiller: count((r) => (r.self_role === 'survivor' ? r.killer_name : null)),
    topPerk: [...perkTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

export function recap({ offset = 0 } = {}) {
  const now = Date.now();
  const cur = weekAgg(offset, now);
  const prev = weekAgg(offset + 1, now);
  const delta = {};
  for (const k of ['matches', 'wins', 'winRate', 'bp', 'avgBp', 'bestStreak']) {
    if (cur[k] != null && prev[k] != null) delta[k] = cur[k] - prev[k];
  }
  return { offset, current: cur, previous: prev, delta };
}

/**
 * Trends computed directly from tracked match history (no BHVR snapshot needed).
 * Each series is a trailing-window rolling average, one point per relevant match.
 * Accuracy improves as more matches accumulate — caller shows a note.
 */
export function history({ rollingN = 15 } = {}) {
  const n = Math.max(3, Math.min(50, rollingN));
  const rows = sqlite
    .prepare(
      `SELECT m.played_at, m.self_role, m.self_bloodpoints,
              ${wonExpr('m')} AS won,
              sp.emblems AS emblems
       FROM matches m
       JOIN match_players sp ON sp.match_id = m.match_id AND sp.is_self = 1
       WHERE m.outcome IS NOT 'canceled'
       ORDER BY m.played_at ASC`,
    )
    .all();

  const rolling = (arr, valueOf) => {
    const out = [];
    const buf = [];
    for (const r of arr) {
      const v = valueOf(r);
      if (v == null) continue;
      buf.push({ t: r.played_at, v });
      if (buf.length > n) buf.shift();
      out.push({ t: r.played_at, value: buf.reduce((a, b) => a + b.v, 0) / buf.length });
    }
    return out;
  };

  const survivor = rows.filter((r) => r.self_role === 'survivor');
  const killer = rows.filter((r) => r.self_role === 'killer');

  return {
    rollingN: n,
    totalMatches: rows.length,
    series: {
      overallWinRate: rolling(rows, (r) => (r.won == null ? null : (r.won ? 1 : 0))),
      escapeRate: rolling(survivor, (r) => (r.won == null ? null : (r.won ? 1 : 0))),
      killRate: rolling(killer, (r) => (r.won == null ? null : (r.won ? 1 : 0))),
      avgBloodpoints: rolling(rows, (r) => r.self_bloodpoints ?? null),
      emblemScore: rolling(rows, (r) => emblemSum(safeJson(r.emblems, []))),
    },
  };
}

/** Usage-vs-performance points for a scatter chart. */
export function scatter({ dimension = 'my-killers' } = {}) {
  switch (dimension) {
    case 'vs-killers':
      return killerAnalytics().map((r) => ({ id: r.killerId, name: r.killerName, uses: r.matches, rate: r.escapeRate, role: 'survivor' }));
    case 'my-killers':
      return selfKillerAnalytics().map((r) => ({ id: r.killerId, name: r.killerName, uses: r.matches, rate: r.winRate, role: 'killer' }));
    case 'builds':
      return buildAnalytics({ minMatches: 1 }).map((r) => ({ id: r.perkId, name: r.perkName, uses: r.matches, rate: r.escapeRate }));
    case 'maps':
      return mapAnalytics().map((r) => ({ id: `${r.mapId}:${r.role}`, name: r.mapName ?? r.mapId, uses: r.matches, rate: r.role === 'survivor' ? r.escapeRate : r.killerWinRate, role: r.role }));
    case 'offerings':
      return offeringAnalytics({ minMatches: 1 }).map((r) => ({ id: r.offeringId, name: r.offeringName, uses: r.matches, rate: r.rate, role: r.role }));
    default:
      return [];
  }
}

// ------------------------------------------------------------------------ meta

/** How often you face each killer (survivor matches) + your rate vs them. */
export function killerMeta() {
  return sqlite
    .prepare(
      `SELECT killer_id, killer_name,
              COUNT(*) AS faced,
              SUM(CASE WHEN self_escaped THEN 1 ELSE 0 END) AS escapes
       FROM matches
       WHERE self_role = 'survivor' AND ${NOT_CANCELED} AND killer_id IS NOT NULL
       GROUP BY killer_id
       ORDER BY faced DESC`,
    )
    .all()
    .map((r) => ({
      killerId: r.killer_id, killerName: r.killer_name,
      faced: r.faced, escapes: r.escapes,
      escapeRate: r.faced ? r.escapes / r.faced : null,
    }));
}

/** Perks the opposition runs against you, ranked by frequency. */
export function opponentPerkMeta({ role = 'survivor', limit = 20 } = {}) {
  // role = which side of the opposition: 'survivor' = other survivors, 'killer' = the killer
  return sqlite
    .prepare(
      `SELECT json_extract(je.value, '$.id')   AS perk_id,
              json_extract(je.value, '$.name') AS perk_name,
              COUNT(*) AS uses,
              COUNT(DISTINCT op.match_id) AS matches
       FROM matches m
       JOIN match_players op
         ON op.match_id = m.match_id AND op.is_self = 0 AND op.role = :role
       JOIN json_each(op.perks) je
       WHERE m.${NOT_CANCELED}
       GROUP BY perk_id
       ORDER BY uses DESC
       LIMIT :limit`,
    )
    .all({ role, limit })
    .map((r) => ({ perkId: r.perk_id, perkName: r.perk_name, uses: r.uses, matches: r.matches }));
}

/** Matches per calendar day — for a contribution-style heatmap. */
export function activity({ days = 120 } = {}) {
  const since = Date.now() - days * 86_400_000;
  return sqlite
    .prepare(
      `SELECT date(played_at / 1000, 'unixepoch') AS day,
              COUNT(*) AS matches,
              SUM(CASE WHEN ${WON_EXPR} THEN 1 ELSE 0 END) AS wins,
              SUM(self_bloodpoints) AS bp
       FROM matches
       WHERE played_at >= :since
       GROUP BY day
       ORDER BY day`,
    )
    .all({ since });
}

/** Average score-category values for the self player, per role — for a radar. */
export function scoreProfile() {
  const rows = sqlite
    .prepare(
      `SELECT m.self_role, sp.post_game_stat
       FROM matches m
       JOIN match_players sp ON sp.match_id = m.match_id AND sp.is_self = 1
       WHERE m.${NOT_CANCELED} AND sp.post_game_stat IS NOT NULL`,
    )
    .all();

  const acc = { survivor: {}, killer: {} };
  const counts = { survivor: 0, killer: 0 };
  for (const r of rows) {
    const role = r.self_role;
    if (!acc[role]) continue;
    let pg;
    try { pg = JSON.parse(r.post_game_stat); } catch { continue; }
    counts[role] += 1;
    for (const [k, v] of Object.entries(pg)) {
      const label = k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');
      acc[role][label] = (acc[role][label] ?? 0) + v;
    }
  }
  const out = {};
  for (const role of ['survivor', 'killer']) {
    out[role] = Object.entries(acc[role]).map(([label, sum]) => ({
      label, avg: counts[role] ? Math.round(sum / counts[role]) : 0,
    }));
  }
  return out;
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

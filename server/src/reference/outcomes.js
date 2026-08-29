/**
 * The single source of truth for self-perspective match outcomes.
 *
 * A survivor match's `outcome` is the player's end status:
 *   escaped | died | sacrificed | dc | ragequit | surrender_loss | surrender_draw
 * A killer match's `outcome` is the grade marker ("MERCILESS KILLER" …) or 'dc'.
 *
 *   'canceled'       — lobby / load cancel. Neutral: excluded from every rate.
 *   'surrender_draw' — a survivor surrender vote BHVR flags as a draw (its payload
 *                      even labels it "ESCAPED", and it reuses the loss icon). It
 *                      is neither a real escape nor a clean loss, so we treat it
 *                      as neutral too — out of rates, streaks and the form strip.
 *
 * Everything downstream (analytics SQL, the normalizer, the "likely factors"
 * heuristic, and the web via web/src/outcomes.js) imports from here so a "win"
 * means exactly one thing in one place.
 */

/** Kills (dead + sacrificed survivors) a killer needs for a win. */
export const KILLER_WIN_KILLS = 3;

/** Survivor end-states that mean "did not escape" — drives the downed portrait art. */
export const SURVIVOR_DOWNED = new Set([
  'died', 'sacrificed', 'dc', 'ragequit', 'surrender_loss',
]);

/** A player (self or opponent) left the match before it ended. */
export const LEFT_EARLY = new Set(['dc', 'ragequit']);

/** Survivor was killed by the killer — counts toward the killer's kill total. */
export const SURVIVOR_KILLED = new Set(['died', 'sacrificed']);

/** Outcomes that are neither a win nor a loss: excluded from rates and streaks. */
export const NEUTRAL_OUTCOMES = new Set(['canceled', 'surrender_draw']);

/**
 * Did the survivor win this match?  true | false | null (undecided/neutral).
 * `escaped` is the only clean survivor win.
 */
export function survivorEscaped(outcome) {
  if (outcome === 'escaped') return true;
  if (outcome == null || NEUTRAL_OUTCOMES.has(outcome)) return null;
  return false;
}

/** WHERE fragment: the match is decided (has a real win / loss). NULL-safe. */
export function decidedWhere(alias = '') {
  const c = alias ? `${alias}.outcome` : 'outcome';
  return `${c} IS NOT 'canceled' AND ${c} IS NOT 'surrender_draw'`;
}

/** SQL CASE → 1 / 0 / NULL for "self won this match". Pass a table alias if joined. */
export function wonSql(alias = '') {
  const p = alias ? `${alias}.` : '';
  return `CASE
    WHEN ${p}outcome IS 'canceled' OR ${p}outcome IS 'surrender_draw' THEN NULL
    WHEN ${p}self_role = 'survivor' THEN (${p}self_escaped = 1)
    WHEN ${p}self_role = 'killer'   THEN (${p}self_kills >= ${KILLER_WIN_KILLS})
    ELSE NULL END`;
}

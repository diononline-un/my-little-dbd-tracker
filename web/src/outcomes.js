/**
 * Web mirror of server/src/reference/outcomes.js — the one place the dashboard
 * decides what a survivor `outcome` means. Keep the two in sync.
 *
 *   escaped                        → a clean win
 *   died | sacrificed | dc |
 *   ragequit | surrender_loss      → a loss ("downed" — dims the portrait)
 *   canceled | surrender_draw      → neutral, not shown as W or L
 */
export const SURVIVOR_ESCAPED = new Set(['escaped']);

export const SURVIVOR_DOWNED = new Set([
  'died', 'sacrificed', 'dc', 'ragequit', 'surrender_loss',
]);

export const NEUTRAL_OUTCOMES = new Set(['canceled', 'surrender_draw']);

export const isEscape = (o) => SURVIVOR_ESCAPED.has(o);
export const isDowned = (o) => SURVIVOR_DOWNED.has(o);

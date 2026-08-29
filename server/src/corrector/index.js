/**
 * The Entity Corrector pipeline.
 *
 * Runs ordered rules over a normalized `{ match, players }`. Rules mutate the
 * match/players in place and return a correction note (or an array of them, or
 * null). The raw payload is never touched — immutability is enforced upstream in
 * the repository, which stores raw bodies separately and read-only.
 *
 * Order matters: lobby-dc first (it can short-circuit the others by setting
 * outcome = 'canceled'), then ragequit, then missing-loadout.
 */
import { lobbyDc } from './rules/lobby-dc.js';
import { ragequit } from './rules/ragequit.js';
import { missingLoadout } from './rules/missing-loadout.js';

const RULES = [
  { name: 'lobby-dc', fn: lobbyDc },
  { name: 'ragequit', fn: ragequit },
  { name: 'missing-loadout', fn: missingLoadout },
];

/**
 * @param {{match: object, players: object[]}} normalized
 * @param {object} ctx  { now: Date, delayMinutes, maxAttempts, attempts }
 * @returns the same `normalized` object, with match.isCorrected / correctionNotes set.
 */
export function runCorrector(normalized, ctx = {}) {
  const context = {
    now: ctx.now ?? new Date(),
    delayMinutes: ctx.delayMinutes ?? 15,
    maxAttempts: ctx.maxAttempts ?? 3,
    attempts: ctx.attempts ?? 0,
  };

  const notes = [];
  for (const { name, fn } of RULES) {
    let result;
    try {
      result = fn(normalized, context);
    } catch (err) {
      notes.push({ rule: name, reason: `rule threw: ${err.message}`, error: true });
      continue;
    }
    if (!result) continue;
    for (const n of Array.isArray(result) ? result : [result]) notes.push(n);
  }

  if (notes.length) {
    normalized.match.isCorrected = true;
    normalized.match.correctionNotes = notes;
  }
  return normalized;
}

/**
 * Rule: Canceled (Lobby DC).
 *
 * PRD §3: "Duration < 4 mins + 0 BP ... If all are 0, or Killer has minimal BP →
 * flag match as Canceled (Lobby DC). Exclude from win-rate metrics."
 *
 * Real-data refinement (docs/api-contract.md, fixture match 4): when someone DCs
 * before loading in, only THAT player shows 0 BP / no emblems / timeInMatch === -1;
 * the rest still earn points. So we key on a never-loaded player (usually the
 * killer) plus a short match, not on everyone being at 0.
 */
const CANCEL_MAX_DURATION = 240; // seconds
const KILLER_MIN_BP = 2000;

export function lobbyDc({ match, players }) {
  if ((match.durationSeconds ?? Infinity) >= CANCEL_MAX_DURATION) return null;

  const killer = players.find((p) => p.role === 'killer');
  const neverLoaded = players.filter((p) => p.timeInMatch === -1);
  const killerBarelyThere =
    killer && (killer.bloodpoints ?? 0) <= KILLER_MIN_BP;
  const allZeroBp = players.every((p) => (p.bloodpoints ?? 0) === 0);

  if (neverLoaded.length === 0 && !killerBarelyThere && !allZeroBp) return null;

  const before = match.outcome;
  match.outcome = 'canceled';

  return {
    rule: 'lobby-dc',
    reason:
      `Match ${match.durationSeconds}s with ` +
      (neverLoaded.length
        ? `${neverLoaded.length} player(s) that never loaded in (timeInMatch -1)`
        : allZeroBp
          ? 'every player at 0 BP'
          : `killer at ${killer?.bloodpoints ?? 0} BP`) +
      '. Treated as a canceled lobby; excluded from win-rate metrics.',
    before: { outcome: before },
    after: { outcome: 'canceled' },
  };
}

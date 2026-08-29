/**
 * Rule: Missing Killer Loadout → deferred re-poll.
 *
 * PRD §3: "Checks if the player died early while the match is ongoing → defers
 * logging. Extension repolls the specific match ID 15 mins later."
 *
 * BHVR sometimes serves a match before every player's loadout has materialized
 * (typically the killer's, when you died early). We don't drop the match — we
 * store what we have and set `repollAfter` so the ingestion loop re-fetches it.
 * The attempt cap lives in the repository / repoll-queue, not here.
 */
export function missingLoadout({ match, players }, { now, delayMinutes, maxAttempts, attempts = 0 }) {
  if (match.outcome === 'canceled') return null;
  if (attempts >= maxAttempts) return null; // give up quietly; keep partial data

  const loadoutEmpty = (p) =>
    p.perks.length === 0 && p.addons.length === 0 && !p.powerId && !p.offeringId;

  // Only players who clearly took part but have a blank loadout are suspicious.
  const suspects = players.filter(
    (p) => loadoutEmpty(p) && ((p.timeInMatch ?? -1) > 0 || (p.bloodpoints ?? 0) > 0),
  );
  if (suspects.length === 0) return null;

  const nextPoll = new Date(now.getTime() + delayMinutes * 60_000);
  match.repollAfter = nextPoll;

  return {
    rule: 'missing-loadout',
    reason:
      `${suspects.length} player(s) (${suspects
        .map((p) => p.characterName ?? p.characterId ?? `slot ${p.slot}`)
        .join(', ')}) have an empty loadout despite playing. ` +
      `Deferring — re-poll scheduled for ${nextPoll.toISOString()} (attempt ${attempts + 1}/${maxAttempts}).`,
    before: { repollAfter: null },
    after: { repollAfter: nextPoll.toISOString() },
  };
}

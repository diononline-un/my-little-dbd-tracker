/**
 * Rule: Abandoned / Ragequit.
 *
 * PRD §3: "Evaluates match duration and generator completion status → marks
 * specific player as Ragequit/DC."
 *
 * The match-history payload exposes no generator count, so we distinguish a
 * mid-match ragequit from a lobby DC by whether the player actually loaded in and
 * played for a bit before the disconnect:
 *   - timeInMatch === -1  → never loaded  → leave as 'dc' (lobby-dc rule owns it)
 *   - played > RAGEQUIT_MIN_PLAYED and left well before match end → 'ragequit'
 */
const RAGEQUIT_MIN_PLAYED = 45; // seconds in-match before the DC
const EARLY_EXIT_RATIO = 0.8; // left before 80% of match duration elapsed

export function ragequit({ match, players }) {
  if (match.outcome === 'canceled') return null; // lobby-dc already resolved this

  const notes = [];
  const duration = match.durationSeconds ?? 0;

  for (const p of players) {
    if (p.status !== 'dc') continue;
    if ((p.timeInMatch ?? -1) < RAGEQUIT_MIN_PLAYED) continue;
    if (duration > 0 && (p.timeInMatch ?? 0) > duration * EARLY_EXIT_RATIO) continue;

    p.status = 'ragequit';
    notes.push({
      rule: 'ragequit',
      reason:
        `${p.role} ${p.characterName ?? p.characterId ?? `slot ${p.slot}`} disconnected ` +
        `after ${p.timeInMatch}s of a ${duration}s match — reclassified DC → ragequit.`,
      before: { slot: p.slot, status: 'dc' },
      after: { slot: p.slot, status: 'ragequit' },
    });
  }

  // If self ragequit, reflect it in the self-perspective outcome.
  const self = players.find((p) => p.isSelf);
  if (self && self.status === 'ragequit' && match.outcome === 'dc') {
    match.outcome = 'ragequit';
  }

  return notes.length ? notes : null;
}

/**
 * The 4 score categories per role — one place for label, short label, colour and
 * canonical order. Previously duplicated across MatchCard, MatchDetailBody and api.js.
 *
 * `postGameStat` keys are `DBD_CamperScoreCat_*` (survivor) / `DBD_SlasherScoreCat_*`
 * (killer). Survivor categories use a cool colour ramp, killer categories a warm
 * one (tokens in theme.css) so a score bar's role is obvious at a glance.
 */

export const label = (key) => key.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');
export const short = (key) => label(key).slice(0, 3);

/** Fixed render order: survivor cats, then killer cats. */
export const ORDER = [
  'Objectives', 'Altruism', 'Boldness', 'Survival',
  'Hunter', 'Deviousness', 'Brutality', 'Sacrifice',
];

const COLOR = {
  // survivor — cool
  Objectives: 'var(--cat-objectives)', Altruism: 'var(--cat-altruism)',
  Boldness: 'var(--cat-boldness)', Survival: 'var(--cat-survival)',
  // killer — warm
  Hunter: 'var(--cat-hunter)', Deviousness: 'var(--cat-deviousness)',
  Brutality: 'var(--cat-brutality)', Sacrifice: 'var(--cat-sacrifice)',
};

/** Colour for a raw key or a stripped label. Falls back to the dim text token. */
export const color = (keyOrLabel) => COLOR[label(keyOrLabel)] ?? 'var(--text-dim)';

/** post_game_stat object → [[key, value], …] in ORDER. */
export const orderedCats = (pgs) => {
  if (!pgs) return [];
  return Object.entries(pgs).sort(
    (a, b) => ORDER.indexOf(label(a[0])) - ORDER.indexOf(label(b[0])),
  );
};

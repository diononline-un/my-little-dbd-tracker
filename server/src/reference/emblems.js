/**
 * Estimated pip / grade model.
 *
 * BHVR's API exposes **no** pips, grade, rank or MMR — the only rank-like signal
 * per match is the 4 emblems and their quality (None…Iridescent). Historically
 * the emblem qualities drove pip gain, so we reconstruct an *estimate* here.
 * Everything derived from this is labelled "estimated" in the UI.
 *
 * The exact quality→point and point→pip thresholds should be confirmed against
 * the official DBD wiki (Grade / Emblem pages). The bands below are the widely
 * documented values; they live in one place so they are trivial to correct.
 * Not modelled (approximation): the monthly grade reset, and the rule that the
 * very top grades cannot double-pip.
 */

export const EMBLEM_POINTS = { None: 0, Bronze: 1, Silver: 2, Gold: 3, Iridescent: 4 };

/** Sum of the 4 emblem qualities → 0..16. null when a match has no emblems. */
export function emblemPointSum(emblems) {
  if (!Array.isArray(emblems) || !emblems.length) return null;
  return emblems.reduce((a, e) => a + (EMBLEM_POINTS[e?.emblem_quality] ?? 0), 0);
}

/** point sum (0..16) → pip delta for the match. Upper bound inclusive. */
export const PIP_BANDS = [
  { upTo: 4, delta: -1 },
  { upTo: 9, delta: 0 },
  { upTo: 13, delta: 1 },
  { upTo: 16, delta: 2 },
];

/** Emblems → estimated pip movement for the match (-1 | 0 | +1 | +2), or null. */
export function pipDelta(emblems) {
  const s = emblemPointSum(emblems);
  if (s == null) return null;
  return (PIP_BANDS.find((b) => s <= b.upTo) ?? PIP_BANDS[PIP_BANDS.length - 1]).delta;
}

/**
 * The 20 DBD grades, lowest → highest, with the pip cost to clear each level.
 * Ash/Bronze: 3 pips per level, Silver/Gold: 4, Iridescent: 5.
 */
const TIERS = [
  { name: 'Ash', pips: 3 },
  { name: 'Bronze', pips: 3 },
  { name: 'Silver', pips: 4 },
  { name: 'Gold', pips: 4 },
  { name: 'Iridescent', pips: 5 },
];

export const GRADE_LADDER = TIERS.flatMap((t) =>
  ['IV', 'III', 'II', 'I'].map((roman) => ({ label: `${t.name} ${roman}`, pips: t.pips })),
);

/** Cumulative pips (clamped ≥ 0) → { index, label, pipsInGrade, gradeFloor }. */
export function estimatedGradeFromPips(cumPips) {
  let floor = 0;
  const p = Math.max(0, cumPips);
  for (let i = 0; i < GRADE_LADDER.length; i += 1) {
    const next = floor + GRADE_LADDER[i].pips;
    if (p < next || i === GRADE_LADDER.length - 1) {
      return { index: i, label: GRADE_LADDER[i].label, pipsInGrade: p - floor, gradeFloor: floor };
    }
    floor = next;
  }
  return { index: 0, label: GRADE_LADDER[0].label, pipsInGrade: 0, gradeFloor: 0 };
}

/**
 * DBD wipes progress every month. We approximate that by knocking the running
 * total back this many pips (≈ 4 grades) on a calendar-month boundary, floored
 * at 0 — otherwise a long tracking window drifts to an implausible top grade.
 */
export const MONTHLY_RESET_PIPS = 16;

/**
 * Fold a chronological list of matches into a running estimated grade.
 * Each item: `{ emblems, playedAt }` (playedAt in epoch ms; optional — pass a
 * plain emblems array and the monthly reset is skipped).
 * Applies "de-pip cannot drop you a grade level": cumulative pips never fall
 * below the current level's floor (within a month).
 * Returns [{ delta, cumPips, index, label, pipsInGrade }] aligned to the input.
 */
export function runGradeTrend(matches) {
  let cum = 0;
  let floor = 0;
  let month = null;
  const out = [];
  for (const item of matches) {
    const emblems = Array.isArray(item) ? item : item?.emblems;
    const playedAt = Array.isArray(item) ? null : item?.playedAt;

    if (playedAt != null) {
      const d = new Date(playedAt);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (month != null && key !== month) {
        cum = Math.max(0, cum - MONTHLY_RESET_PIPS);
        floor = estimatedGradeFromPips(cum).gradeFloor;
      }
      month = key;
    }

    const delta = pipDelta(emblems);
    if (delta != null) {
      cum = Math.max(floor, cum + delta);
      const g = estimatedGradeFromPips(cum);
      floor = g.gradeFloor;
      out.push({ delta, cumPips: cum, index: g.index, label: g.label, pipsInGrade: g.pipsInGrade });
    } else {
      const g = estimatedGradeFromPips(cum);
      out.push({ delta: null, cumPips: cum, index: g.index, label: g.label, pipsInGrade: g.pipsInGrade });
    }
  }
  return out;
}

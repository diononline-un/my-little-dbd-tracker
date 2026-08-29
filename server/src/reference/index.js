/**
 * BHVR stats reference helpers.
 *
 * Display names and image paths arrive INLINE in every match-history payload
 * (localized by the `lang` query param), so we mostly pass them through. This
 * module only holds the few constants the payload does not give us and small
 * classifiers used by analytics.
 */

export const ASSET_BASE = 'https://assets.live.bhvraccount.com';

/**
 * BHVR internal game-mode codenames → display labels. `match-categories` in a
 * career payload lists which of these currently have stats. "Total" is a BHVR
 * bug (returns all-zero) — always query per real category and aggregate.
 */
export const MATCH_CATEGORIES = {
  Regular: 'Regular Trials',
  Calamari: '2v8',
  ChocolateBox: 'Chaos Shuffle',
  Firefly: 'Lights Out',
  Cake: 'My Little Oni',
};

export const REAL_CATEGORIES = Object.keys(MATCH_CATEGORIES); // excludes 'Total'

export function categoryLabel(id) {
  return MATCH_CATEGORIES[id] ?? id;
}

export const EMBLEM_QUALITIES = ['None', 'Bronze', 'Silver', 'Gold', 'Iridescent'];

export function emblemLabel(emblemId) {
  // "Emblem_Survivor_Benevolent" -> "Benevolent"
  return String(emblemId ?? '').split('_').pop();
}

/** postGameStat keys -> readable score categories, per role. */
export const SCORE_CATEGORIES = {
  DBD_CamperScoreCat_Objectives: 'Objectives',
  DBD_CamperScoreCat_Altruism: 'Altruism',
  DBD_CamperScoreCat_Boldness: 'Boldness',
  DBD_CamperScoreCat_Survival: 'Survival',
  DBD_SlasherScoreCat_Brutality: 'Brutality',
  DBD_SlasherScoreCat_Deviousness: 'Deviousness',
  DBD_SlasherScoreCat_Hunter: 'Hunting',
  DBD_SlasherScoreCat_Sacrifice: 'Sacrifice',
};

export function scoreCategories(postGameStat) {
  if (!postGameStat) return [];
  return Object.entries(postGameStat).map(([k, v]) => ({
    key: k,
    label: SCORE_CATEGORIES[k] ?? k,
    value: v,
  }));
}

/** Prefix a payload `image.path` with the asset host. */
export function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${ASSET_BASE}/${path.replace(/^\/+/, '')}`;
}

export const ROLE = {
  VE_Slasher: 'killer',
  VE_Camper: 'survivor',
};

export function roleFromApi(playerRole) {
  return ROLE[playerRole] ?? 'unknown';
}

/**
 * Normalized per-player outcome. Survivors carry `playerStatus.id`; killers carry
 * `killerMatchStatus` (a grade string) and only get a `playerStatus` when they DC.
 */
export const PLAYER_STATUS = {
  VE_Escaped: 'escaped',
  VE_Killed: 'died',
  VE_Sacrificed: 'sacrificed',
  VE_Disconnected: 'dc',
  VE_SurrenderLoss: 'surrender_loss',
  VE_SurrenderDraw: 'surrender_draw',
};

export function playerStatusFromApi(playerStatusId) {
  return PLAYER_STATUS[playerStatusId] ?? null;
}

/** Killer end-of-match grade → rough "did the killer win" signal. */
export const KILLER_GRADE = new Set([
  'THE ENTITY HUNGERS...',
  'BRUTAL KILLER',
  'RUTHLESS KILLER',
  'MERCILESS KILLER',
]);

export function isKillerGrade(s) {
  return typeof s === 'string' && KILLER_GRADE.has(s);
}

/** True when this raw player object is someone who never really loaded in. */
export function playerNeverPlayed(rawPlayer) {
  return (
    rawPlayer?.playerTimeInMatch === -1 ||
    (rawPlayer?.bloodpointsEarned === 0 &&
      (!rawPlayer?.emblems || rawPlayer.emblems.length === 0) &&
      !rawPlayer?.platform)
  );
}

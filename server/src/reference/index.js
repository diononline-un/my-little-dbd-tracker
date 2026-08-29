/**
 * BHVR stats reference helpers.
 *
 * Display names and image paths arrive INLINE in every match-history payload
 * (localized by the `lang` query param), so we mostly pass them through. This
 * module only holds the few constants the payload does not give us and small
 * classifiers used by analytics.
 */

export const ASSET_BASE = 'https://assets.live.bhvraccount.com';

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

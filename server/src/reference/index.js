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

// ---------------------------------------------------------------------------
// Perk / killer classification for the per-match "likely factors" analyzer.
// Matched on a normalized display name (lowercase, alnum only) since the
// payload's perk display names are more stable than the ids.
// ---------------------------------------------------------------------------

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const PERK_GROUPS = {
  killerSlowdown: [
    'Hex: Ruin', 'Scourge Hook: Pain Resonance', 'Pop Goes the Weasel', 'Eruption',
    'Deadlock', 'Grim Embrace', 'Corrupt Intervention', "Dead Man's Switch", 'Oppression',
    'Call of Brine', 'Overcharge', 'Scourge Hook: Gift of Pain', 'Hex: Pentimento',
    'Trail of Torment', 'Hex: Plaything', 'No Way Out',
  ],
  killerInfo: [
    'Barbecue & Chili', 'Lethal Pursuer', 'Nowhere to Hide', "A Nurse's Calling",
    "I'm All Ears", 'Scourge Hook: Floods of Rage', 'Darkness Revealed', 'Bitter Murmur',
    'Discordance', 'Weave Attunement', 'Nemesis',
  ],
  killerEndgame: ['Hex: No One Escapes Death', 'No One Escapes Death', 'Bloodwarden', 'Remember Me', 'Terminus'],
  killerChase: [
    'Bamboozle', 'Enduring', 'Spirit Fury', 'Hex: Blood Favor', 'Save the Best for Last',
    'Brutal Strength', 'Fire Up', 'Bloodhound', 'Coup de Grâce',
  ],
  survSecondChance: [
    'Decisive Strike', 'Off the Record', 'Dead Hard', 'Unbreakable', 'Adrenaline',
    'Deliverance', 'Soul Guard', 'Power Struggle', 'Flip-Flop', 'Buckle Up',
  ],
  survExhaustion: ['Sprint Burst', 'Lithe', 'Balanced Landing', 'Dead Hard', 'Overcome', 'Head On', 'Smash Hit'],
  survChase: ['Windows of Opportunity', 'Bond', 'Fixated', 'Quick & Quiet', 'Lucky Break', 'Iron Will', 'Resilience'],
  survGen: ['Prove Thyself', 'Deja Vu', 'Hyperfocus', 'Stake Out', 'Built to Last', 'Blast Mine', 'Made for This', 'Five Moves Ahead'],
  survAltruism: [
    "We'll Make It", 'Botany Knowledge', 'Autodidact', 'Empathy', "We're Gonna Live Forever",
    'For the People', 'Reassurance', 'Guardian', 'Kindred', 'Bond',
  ],
};

const PERK_TAG = new Map();
for (const [group, names] of Object.entries(PERK_GROUPS)) {
  for (const n of names) PERK_TAG.set(norm(n), group);
}

/** Tags for a loadout's perk list: { killerSlowdown: [names], ... }. */
export function tagPerks(perks = []) {
  const out = {};
  for (const p of perks) {
    const tag = PERK_TAG.get(norm(p?.name)) ?? PERK_TAG.get(norm(p?.id));
    if (tag) (out[tag] ??= []).push(p.name || p.id);
  }
  return out;
}

/** High-pressure / high-mobility killers — for a "tough matchup" note. */
export const STRONG_KILLERS = new Set(
  ['The Nurse', 'The Blight', 'The Spirit', 'The Hillbilly', 'The Huntress', 'The Oni',
   'The Artist', 'The Mastermind', 'The Good Guy', 'The Wraith', 'The Executioner',
   'The Plague', 'The Nightmare', 'The Dark Lord', 'The Lich', 'The Houndmaster'].map(norm),
);
export function isStrongKiller(name) {
  return STRONG_KILLERS.has(norm(name));
}

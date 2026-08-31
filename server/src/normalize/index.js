/**
 * Turn a raw BHVR match-history payload into EntityTrack's normalized shape.
 *
 * Input: the JSON array returned by
 *   GET /player-stats/match-history/games/dbd/providers/bhvr
 * (a single match object is also accepted).
 *
 * Output: NormalizedMatch[] — each `{ match, players }`, ready for the corrector
 * and repository. Pure: no DB, no clock beyond deriving timestamps from the data.
 *
 * See docs/api-contract.md for field meanings.
 */
import {
  roleFromApi,
  playerStatusFromApi,
  isKillerGrade,
} from '../reference/index.js';
import { SURVIVOR_KILLED, survivorEscaped } from '../reference/outcomes.js';

/** synthetic match id — the payload has none; matchStartTime (unix s) is unique. */
export function matchIdOf(raw) {
  return String(raw?.matchStat?.matchStartTime ?? '');
}

function normalizePlayer(rawPlayer, slot, isSelf) {
  const role = roleFromApi(rawPlayer.playerRole);
  const loadout = rawPlayer.characterLoadout ?? {};
  const statusId = rawPlayer.playerStatus?.id ?? null;
  const mappedStatus = playerStatusFromApi(statusId);
  const killerGrade = isKillerGrade(rawPlayer.killerMatchStatus)
    ? rawPlayer.killerMatchStatus
    : null;

  return {
    slot,
    role,
    isSelf,
    characterId: rawPlayer.characterName?.id ?? null,
    characterName: rawPlayer.characterName?.name ?? null,
    prestige: rawPlayer.prestigeLevel ?? null,
    characterLevel: rawPlayer.characterLevel ?? null,
    platform: rawPlayer.platform ?? null,
    timeInMatch: rawPlayer.playerTimeInMatch ?? null,
    bloodpoints: rawPlayer.bloodpointsEarned ?? null,
    leaderboardScore: rawPlayer.leaderboardScore ?? null,
    postGameStat: rawPlayer.postGameStat ?? null,
    emblems: rawPlayer.emblems ?? [],
    perks: (loadout.perks ?? []).map((p) => ({ id: p.id, name: p.name })),
    addons: (loadout.addOns ?? []).map((a) => ({ id: a.id, name: a.name })),
    offeringId: loadout.offering?.id ?? null,
    offeringName: loadout.offering?.name ?? null,
    powerId: loadout.power?.id ?? null,
    powerName: loadout.power?.name ?? null,
    // killers without a DC have no playerStatus — record the grade marker instead
    status: mappedStatus ?? (killerGrade ? 'killer_grade' : null),
    killerGrade,
  };
}

function normalizeOne(raw) {
  const ms = raw.matchStat ?? {};
  const selfRaw = raw.playerStat ?? {};
  const oppRaw = Array.isArray(raw.opponentStat) ? raw.opponentStat : [];

  const self = normalizePlayer(selfRaw, 0, true);
  const opponents = oppRaw.map((p, i) => normalizePlayer(p, i + 1, false));
  const players = [self, ...opponents];

  const killer = players.find((p) => p.role === 'killer') ?? null;
  const survivors = players.filter((p) => p.role === 'survivor');

  const selfRole = self.role;
  const startMs = (ms.matchStartTime ?? 0) * 1000;

  // self-perspective outcome
  let outcome = null;
  let selfGrade = null;
  let selfKills = null;
  let selfEscaped = null;
  if (selfRole === 'killer') {
    selfGrade = self.killerGrade;
    outcome = self.status === 'dc' ? 'dc' : (selfGrade ?? null);
    selfKills = survivors.filter((s) => SURVIVOR_KILLED.has(s.status)).length;
  } else if (selfRole === 'survivor') {
    outcome = self.status; // escaped | died | sacrificed | dc | surrender_loss | surrender_draw
    selfEscaped = survivorEscaped(outcome); // true | false | null (surrender_draw = neutral)
  }

  const specialEventId =
    ms.specialEventId && ms.specialEventId !== 'NONE' ? ms.specialEventId : null;

  const match = {
    matchId: matchIdOf(raw),
    playedAt: startMs ? new Date(startMs) : null,
    gameMode: ms.gameType?.id ?? null,
    selfRole,
    isCustomMatch: Boolean(ms.isCustomMatch),
    specialEventId,
    mapId: ms.map?.id ?? ms.mapName ?? null,
    mapName: ms.map?.name ?? null,
    durationSeconds:
      typeof ms.matchDuration === 'number' ? Math.round(ms.matchDuration) : null,
    killerId: killer?.characterId ?? null,
    killerName: killer?.characterName ?? null,
    outcome,
    selfGrade,
    selfKills,
    selfEscaped,
    selfBloodpoints: self.bloodpoints,
    emblems: self.emblems,
    isCorrected: false,
    correctionNotes: [],
    repollAfter: null,
  };

  return { match, players };
}

export function normalize(rawBody) {
  const arr = Array.isArray(rawBody) ? rawBody : [rawBody];
  return arr
    .filter((m) => m && m.matchStat && matchIdOf(m))
    .map(normalizeOne);
}

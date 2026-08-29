/**
 * Per-match "likely factors" — a heuristic read of why a match went the way it
 * did, from perks + score categories + who left / went down early.
 *
 * This is NOT a verdict. Perks and scores don't determine outcomes; these are
 * contributing signals the data actually supports. The UI frames them as
 * "likely factors", never "why you lost".
 */
import { tagPerks, isStrongKiller } from './reference/index.js';
import { SURVIVOR_KILLED as DEAD, LEFT_EARLY as LEFT, KILLER_WIN_KILLS } from './reference/outcomes.js';
const catVal = (p, key) => Number(p.post_game_stat?.[key] ?? 0);

export function analyzeMatch(m) {
  if (!m || !Array.isArray(m.players) || m.outcome === 'canceled') return [];

  const self = m.players.find((p) => p.is_self);
  if (!self) return [];
  const others = m.players.filter((p) => !p.is_self);
  const isKiller = m.self_role === 'killer';
  const survivors = m.players.filter((p) => p.role === 'survivor');
  const killer = m.players.find((p) => p.role === 'killer');
  const dur = m.duration_seconds ?? 0;
  const won = isKiller ? (m.self_kills ?? 0) >= KILLER_WIN_KILLS : Boolean(m.self_escaped);

  const f = [];
  const add = (dir, weight, text) => f.push({ dir, weight, text }); // dir: 'for' | 'against' | 'neutral'

  // --- someone left the match ---
  const leavers = others.filter((p) => LEFT.has(p.status) || p.time_in_match === -1);
  if (leavers.length) {
    const who = leavers.map((p) => p.character_name ?? 'a player').join(', ');
    if (leavers.some((p) => p.role === 'survivor')) {
      add(isKiller ? 'for' : 'against', 'major',
        `${who} disconnected — the survivor side was down a player for much of the trial.`);
    }
    if (leavers.some((p) => p.role === 'killer')) {
      add(isKiller ? 'against' : 'for', 'major', `The killer disconnected.`);
    }
  }

  // --- you (survivor) went down early ---
  if (!isKiller && DEAD.has(self.status) && dur > 0 && self.time_in_match > 0) {
    const frac = self.time_in_match / dur;
    if (frac < 0.55) {
      add('against', 'major',
        `You were out after ${Math.round(self.time_in_match / 60)}m of a ${Math.round(dur / 60)}m match — an early chase loss or tunnel.`);
    }
  }

  // --- killer slowdown pressure ---
  if (killer) {
    const kt = tagPerks(killer.perks);
    if ((kt.killerSlowdown ?? []).length >= 2) {
      add(isKiller ? 'for' : 'against', 'major',
        `Killer ran ${kt.killerSlowdown.length} slowdown perks (${kt.killerSlowdown.join(', ')}) — heavy gen pressure.`);
    }
    if ((kt.killerEndgame ?? []).length) {
      add(isKiller ? 'for' : 'against', 'minor', `Killer ran ${kt.killerEndgame.join(', ')} (endgame pressure).`);
    }
    if (isStrongKiller(killer.character_name)) {
      add(isKiller ? 'for' : 'against', 'minor', `${killer.character_name} is a high-pressure killer.`);
    }
  }

  // --- gen speed (survivor objective score across the team) ---
  const surrendered = String(m.outcome ?? '').includes('surrender');
  const teamObjectives = survivors.reduce((a, p) => a + catVal(p, 'DBD_CamperScoreCat_Objectives'), 0);
  const avgObj = survivors.length ? teamObjectives / survivors.length : 0;
  if (avgObj >= 6500 && dur > 0 && !surrendered) {
    add(isKiller ? 'against' : 'for', 'major', `Gens flew — team objective score averaged ${Math.round(avgObj).toLocaleString()}.`);
  } else if (avgObj > 0 && avgObj <= 2500) {
    add(isKiller ? 'for' : 'against', 'minor', `Gen progress stalled — team objective score averaged only ${Math.round(avgObj).toLocaleString()}.`);
  }
  if (surrendered) {
    add('neutral', 'minor', `Match ended early by survivor surrender vote.`);
  }

  // --- your chase game (survivor Boldness) ---
  if (!isKiller) {
    const myBold = catVal(self, 'DBD_CamperScoreCat_Boldness');
    const best = Math.max(...survivors.map((p) => catVal(p, 'DBD_CamperScoreCat_Boldness')));
    if (myBold >= 8000 && myBold === best) {
      add('for', 'minor', `Your chase game held up — Boldness ${myBold.toLocaleString()}, highest in the lobby.`);
    }
  }

  // --- survivors loaded with second-chance perks (relevant to a killer loss) ---
  const sc = survivors.reduce((a, p) => a + (tagPerks(p.perks).survSecondChance ?? []).length, 0);
  if (sc >= 4) {
    add(isKiller ? 'against' : 'for', 'minor', `Survivors brought ${sc} second-chance / anti-tunnel perks between them.`);
  }

  // --- everyone lived a long time + escape ---
  if (!isKiller && won && dur > 0 && survivors.every((p) => (p.time_in_match ?? 0) > dur * 0.75)) {
    add('for', 'minor', `Nobody went down early — the whole team stayed alive deep into the match.`);
  }

  // --- killer snowball: short match + win ---
  if (isKiller && won && dur > 0 && dur < 420) {
    add('for', 'minor', `Fast snowball — the match was over in ${Math.round(dur / 60)}m.`);
  }

  // sort: major first, then by direction matching the outcome
  const order = { major: 0, minor: 1 };
  return f.sort((a, b) => order[a.weight] - order[b.weight]).slice(0, 6).map((x) => ({
    ...x,
    // relabel dir relative to the result the player got
    aligned: (won && x.dir === 'for') || (!won && x.dir === 'against'),
  }));
}

import { describe, it, expect } from 'vitest';
import { analyzeMatch } from '../src/factors.js';

// analyzeMatch works on a hydrated match (repository shape + route enrichment):
// { self_role, outcome, self_kills, self_escaped, duration_seconds, players: [...] }
const surv = (o = {}) => ({
  is_self: false, role: 'survivor', status: 'escaped', time_in_match: 600,
  character_name: 'Meg Thomas', perks: [], post_game_stat: {}, ...o,
});
const killer = (o = {}) => ({
  is_self: false, role: 'killer', status: 'killer_grade', time_in_match: 600,
  character_name: 'The Trapper', perks: [], post_game_stat: {}, ...o,
});
const match = (o = {}) => ({
  self_role: 'survivor', outcome: 'escaped', self_kills: null, self_escaped: true,
  duration_seconds: 600, players: [], ...o,
});

describe('analyzeMatch — likely-factor heuristic', () => {
  it('returns nothing for canceled / malformed matches', () => {
    expect(analyzeMatch(match({ outcome: 'canceled' }))).toEqual([]);
    expect(analyzeMatch(null)).toEqual([]);
    expect(analyzeMatch(match({ players: undefined }))).toEqual([]);
    expect(analyzeMatch(match({ players: [surv(), killer()] }))).toEqual([]); // no self
  });

  it('flags a teammate disconnect against the survivor and aligns it with the loss', () => {
    const m = match({
      self_escaped: false, outcome: 'died',
      players: [
        surv({ is_self: true, status: 'died', time_in_match: 590 }),
        surv({ status: 'dc', time_in_match: 120, character_name: 'Dwight Fairfield' }),
        surv(), surv(), killer(),
      ],
    });
    const dc = analyzeMatch(m).find((x) => /disconnected/i.test(x.text));
    expect(dc).toMatchObject({ dir: 'against', weight: 'major', aligned: true });
    expect(dc.text).toContain('Dwight Fairfield');
  });

  it('flags a survivor disconnect for the killer', () => {
    const m = match({
      self_role: 'killer', outcome: 'MERCILESS KILLER', self_escaped: null, self_kills: 4,
      players: [
        killer({ is_self: true }),
        surv({ status: 'dc', time_in_match: 90 }),
        surv({ status: 'sacrificed' }), surv({ status: 'sacrificed' }), surv({ status: 'died' }),
      ],
    });
    const dc = analyzeMatch(m).find((x) => /disconnected/i.test(x.text));
    expect(dc).toMatchObject({ dir: 'for', aligned: true });
  });

  it('flags an early chase loss against the survivor', () => {
    const m = match({
      outcome: 'died', self_escaped: false,
      players: [
        surv({ is_self: true, status: 'died', time_in_match: 180 }),
        surv(), surv(), surv(), killer(),
      ],
    });
    const early = analyzeMatch(m).find((x) => /of a \d+m match/.test(x.text));
    expect(early).toMatchObject({ dir: 'against', weight: 'major' });
  });

  it('notes heavy killer slowdown against the survivor', () => {
    const m = match({
      self_escaped: false, outcome: 'sacrificed',
      players: [
        surv({ is_self: true, status: 'sacrificed', time_in_match: 400 }),
        surv(), surv(), surv(),
        killer({ perks: [
          { id: 'Ruin', name: 'Hex: Ruin' },
          { id: 'Pop', name: 'Pop Goes the Weasel' },
          { id: 'Deadlock', name: 'Deadlock' },
        ] }),
      ],
    });
    const slow = analyzeMatch(m).find((x) => /slowdown/i.test(x.text));
    expect(slow).toMatchObject({ dir: 'against', weight: 'major' });
    expect(slow.text).toMatch(/3 slowdown/);
  });

  it('credits fast gens to the survivor side; majors sort first and the list caps at 6', () => {
    const big = { DBD_CamperScoreCat_Objectives: 8000, DBD_CamperScoreCat_Boldness: 9000 };
    const m = match({
      players: [
        surv({ is_self: true, post_game_stat: big }),
        surv({ post_game_stat: big }), surv({ post_game_stat: big }), surv({ post_game_stat: big }),
        killer(),
      ],
    });
    const f = analyzeMatch(m);
    expect(f.length).toBeLessThanOrEqual(6);
    expect(f.find((x) => /gens flew/i.test(x.text))).toMatchObject({ dir: 'for', weight: 'major' });
    const rank = (w) => (w === 'major' ? 0 : 1);
    expect(f.map((x) => rank(x.weight))).toEqual([...f.map((x) => rank(x.weight))].sort());
  });

  it('adds a neutral note for a surrender and suppresses the gen-speed read', () => {
    const big = { DBD_CamperScoreCat_Objectives: 9000 };
    const m = match({
      outcome: 'surrender_loss', self_escaped: false,
      players: [
        surv({ is_self: true, status: 'surrender_loss', post_game_stat: big }),
        surv({ post_game_stat: big }), surv({ post_game_stat: big }), surv({ post_game_stat: big }),
        killer(),
      ],
    });
    const f = analyzeMatch(m);
    expect(f.find((x) => /surrender/i.test(x.text))).toMatchObject({ dir: 'neutral', weight: 'minor' });
    expect(f.some((x) => /gens flew/i.test(x.text))).toBe(false);
  });
});

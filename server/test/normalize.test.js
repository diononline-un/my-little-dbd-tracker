import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { normalize, matchIdOf } from '../src/normalize/index.js';

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/match-history.sample.json', import.meta.url))),
);

describe('normalize (real BHVR fixture)', () => {
  const out = normalize(fixture);

  it('produces one normalized match per raw match', () => {
    expect(out).toHaveLength(fixture.length);
  });

  it('uses matchStartTime as the synthetic match id', () => {
    expect(out[0].match.matchId).toBe(String(fixture[0].matchStat.matchStartTime));
    expect(matchIdOf(fixture[0])).toBe(out[0].match.matchId);
  });

  it('normalizes the killer match (match 0)', () => {
    const { match, players } = out[0];
    expect(match.selfRole).toBe('killer');
    expect(match.mapName).toBe('Ormond Lake Mine');
    expect(match.durationSeconds).toBe(1019);
    expect(match.killerName).toBe('The Shape');
    expect(match.selfGrade).toBe('MERCILESS KILLER');
    expect(match.selfKills).toBe(3); // 2 DEAD + 1 SACRIFICED among the 4 survivors
    expect(players).toHaveLength(5);
    expect(players[0].isSelf).toBe(true);
    expect(players[0].perks.map((p) => p.id)).toContain('Hex_Ruin');
  });

  it('normalizes the survivor escape match (match 1)', () => {
    const { match } = out[1];
    expect(match.selfRole).toBe('survivor');
    expect(match.outcome).toBe('escaped');
    expect(match.selfEscaped).toBe(true);
  });

  it('normalizes a surrender as its own outcome (match 2)', () => {
    expect(out[2].match.outcome).toBe('surrender_loss');
    expect(out[2].match.selfEscaped).toBe(false);
  });

  it('flags the never-loaded killer in the 46s match (match 3)', () => {
    const killer = out[3].players.find((p) => p.role === 'killer');
    expect(killer.timeInMatch).toBe(-1);
    expect(killer.status).toBe('dc');
    expect(killer.bloodpoints).toBe(0);
  });

  it('treats a surrender_draw as neutral — not an escape', () => {
    const raw = {
      matchStat: {
        matchStartTime: 1799999999, matchDuration: 300,
        map: { id: 'Map_X', name: 'Map X' }, gameType: { id: 'None' },
      },
      playerStat: {
        playerRole: 'VE_Camper',
        playerStatus: { id: 'VE_SurrenderDraw', name: 'ESCAPED' },
        characterName: { id: 'Meg', name: 'Meg Thomas' },
      },
      opponentStat: [
        { playerRole: 'VE_Slasher', characterName: { id: 'Trapper', name: 'The Trapper' },
          killerMatchStatus: 'BRUTAL KILLER' },
      ],
    };
    const [{ match }] = normalize(raw);
    expect(match.outcome).toBe('surrender_draw');
    expect(match.selfEscaped).toBeNull();
  });
});

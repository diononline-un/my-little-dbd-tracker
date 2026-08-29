import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { normalize } from '../src/normalize/index.js';
import { runCorrector } from '../src/corrector/index.js';

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/match-history.sample.json', import.meta.url))),
);
const NOW = new Date('2026-08-29T12:00:00Z');
const ctx = { now: NOW, delayMinutes: 15, maxAttempts: 3, attempts: 0 };

describe('Entity Corrector', () => {
  it('flags the 46s killer-DC match as canceled', () => {
    const n = normalize([fixture[3]])[0];
    runCorrector(n, ctx);
    expect(n.match.isCorrected).toBe(true);
    expect(n.match.outcome).toBe('canceled');
    expect(n.match.correctionNotes.map((c) => c.rule)).toContain('lobby-dc');
  });

  it('leaves a clean full-length match untouched', () => {
    const n = normalize([fixture[0]])[0]; // 1019s merciless killer game
    runCorrector(n, ctx);
    expect(n.match.isCorrected).toBe(false);
    expect(n.match.correctionNotes).toEqual([]);
  });

  it('reclassifies a mid-match DC as a ragequit', () => {
    const n = {
      match: { matchId: 't', durationSeconds: 600, outcome: 'died', selfRole: 'survivor',
               isCorrected: false, correctionNotes: [] },
      players: [
        { slot: 0, role: 'survivor', isSelf: true, status: 'died', timeInMatch: 300,
          perks: [{ id: 'x' }], addons: [], bloodpoints: 12000 },
        { slot: 1, role: 'survivor', isSelf: false, status: 'dc', timeInMatch: 120,
          perks: [{ id: 'y' }], addons: [], bloodpoints: 4000 },
        { slot: 2, role: 'killer', isSelf: false, status: 'killer_grade', timeInMatch: 600,
          killerGrade: 'BRUTAL KILLER', perks: [{ id: 'z' }], addons: [], bloodpoints: 20000, powerId: 'p' },
      ],
    };
    runCorrector(n, ctx);
    expect(n.players[1].status).toBe('ragequit');
    expect(n.match.correctionNotes.map((c) => c.rule)).toContain('ragequit');
  });

  it('schedules a re-poll when a player who played has a blank loadout', () => {
    const n = {
      match: { matchId: 't2', durationSeconds: 400, outcome: 'died', selfRole: 'survivor',
               isCorrected: false, correctionNotes: [], repollAfter: null },
      players: [
        { slot: 0, role: 'survivor', isSelf: true, status: 'died', timeInMatch: 90,
          perks: [{ id: 'a' }], addons: [], bloodpoints: 6000, powerId: 'item' },
        { slot: 1, role: 'killer', isSelf: false, status: 'killer_grade', timeInMatch: 400,
          killerGrade: 'RUTHLESS KILLER', perks: [], addons: [], bloodpoints: 15000,
          powerId: null, offeringId: null },
      ],
    };
    runCorrector(n, ctx);
    expect(n.match.repollAfter).toBeInstanceOf(Date);
    expect(n.match.repollAfter.getTime()).toBe(NOW.getTime() + 15 * 60_000);
    expect(n.match.correctionNotes.map((c) => c.rule)).toContain('missing-loadout');
  });

  it('stops scheduling re-polls once the attempt cap is hit', () => {
    const n = {
      match: { matchId: 't3', durationSeconds: 400, outcome: 'died', selfRole: 'survivor',
               isCorrected: false, correctionNotes: [], repollAfter: null },
      players: [
        { slot: 1, role: 'killer', isSelf: false, status: 'killer_grade', timeInMatch: 400,
          perks: [], addons: [], bloodpoints: 15000, powerId: null, offeringId: null },
      ],
    };
    runCorrector(n, { ...ctx, attempts: 3 });
    expect(n.match.repollAfter).toBeNull();
  });
});

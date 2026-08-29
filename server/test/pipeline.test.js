import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ingestPayload } from '../src/ingest-pipeline.js';
import { getMatch } from '../src/repository.js';
import {
  summary, listMatches, buildAnalytics, streaks, recentForm, scoreProfile,
  characterStreaks, sessions, recap, scatter,
} from '../src/analytics.js';

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/match-history.sample.json', import.meta.url)),
  'utf8',
);

describe('ingest pipeline end-to-end (temp SQLite)', () => {
  it('stores raw + normalized + corrected data', () => {
    const res = ingestPayload({ endpoint: '/match-history', body: fixture });
    expect(res.matches).toHaveLength(4);
    expect(res.deduped).toBe(false);

    const canceled = res.matches.find((m) => m.corrections.includes('lobby-dc'));
    expect(canceled).toBeTruthy();

    const stored = getMatch('1787606284'); // the killer match
    expect(stored.selfRole).toBe('killer');
    expect(stored.players).toHaveLength(5);
    expect(stored.isCorrected).toBe(false); // clean match
  });

  it('is idempotent — re-ingesting dedups the raw payload and upserts matches', () => {
    const res = ingestPayload({ endpoint: '/match-history', body: fixture });
    expect(res.deduped).toBe(true);
    expect(listMatches().total).toBe(4);
  });

  it('computes summary excluding canceled matches', () => {
    const s = summary();
    expect(s.totalMatches).toBe(4);
    expect(s.canceledMatches).toBe(1);
    // 3 survivor matches, but one (46s) is canceled -> 2 count toward escape rate
    expect(s.survivor.matches).toBe(2);
    expect(s.killer.matches).toBe(1);
  });

  it('build analytics runs over json_each(perks)', () => {
    const builds = buildAnalytics({ minMatches: 1 });
    expect(Array.isArray(builds)).toBe(true);
    expect(builds.some((b) => b.perkId === 'DeadHard')).toBe(true);
  });

  it('computes streaks and recent form over the fixture', () => {
    // fixture decided matches (newest→oldest): survivor escaped, survivor surrender_loss, killer merciless(3K)
    // (the 46s match is canceled → excluded)
    const s = streaks();
    expect(s.overall.current).toBeGreaterThanOrEqual(1);
    expect(['win', 'loss']).toContain(s.overall.currentType);
    expect(s.survivor.best).toBeGreaterThanOrEqual(0);

    const form = recentForm({ limit: 10 });
    expect(form.matches.length).toBe(3); // 3 decided, 1 canceled excluded
    expect(form.wins + form.losses).toBe(3);
  });

  it('builds a score profile per role from post_game_stat', () => {
    const sp = scoreProfile();
    expect(sp.survivor.some((c) => c.label === 'Boldness' && c.avg > 0)).toBe(true);
    expect(sp.killer.some((c) => ['Hunting', 'Brutality', 'Sacrifice'].includes(c.label))).toBe(true);
  });

  it('buckets per-character streaks by role + character', () => {
    const cs = characterStreaks();
    // fixture: 1 killer match as The Shape, 2 survivor as David King (1 esc, 1 surrender_loss)
    expect(cs.killers.some((k) => k.characterName === 'The Shape')).toBe(true);
    const david = cs.survivors.find((s) => s.characterName === 'David King');
    expect(david?.matches).toBe(2);
    for (const e of [...cs.killers, ...cs.survivors]) {
      expect(e.best).toBeGreaterThanOrEqual(0);
      expect(e.current).toBeLessThanOrEqual(e.matches);
    }
    expect(cs.records.overall).toBeTruthy();
  });

  it('groups matches into sessions and reshapes scatter data', () => {
    const s = sessions({ gapMinutes: 45 });
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s.reduce((a, x) => a + x.count, 0)).toBe(4); // every match lands in a session
    expect(s[0].end).toBeGreaterThanOrEqual(s.at(-1).start); // newest-first

    const pts = scatter({ dimension: 'my-killers' });
    expect(Array.isArray(pts)).toBe(true);
    expect(pts.every((p) => 'uses' in p && 'rate' in p)).toBe(true);
  });

  it('recap returns current + previous week windows with deltas', () => {
    const r = recap({ offset: 0 });
    expect(r.current).toHaveProperty('matches');
    expect(r.current).toHaveProperty('winRate');
    expect(r.previous.to).toBe(r.current.from); // contiguous windows
    expect(typeof r.delta).toBe('object');
  });
});

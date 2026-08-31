import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ingestPayload } from '../src/ingest-pipeline.js';
import { getMatch } from '../src/repository.js';
import { analyzeMatch } from '../src/factors.js';
import {
  summary, listMatches, buildAnalytics, streaks, recentForm, scoreProfile,
  characterStreaks, sessions, recap, scatter, history, emblemSum,
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

  it('emblemSum maps qualities to 0–16 and history returns rolling series', () => {
    expect(emblemSum([
      { emblem_quality: 'Iridescent' }, { emblem_quality: 'Gold' },
      { emblem_quality: 'Silver' }, { emblem_quality: 'None' },
    ])).toBe(9); // 4 + 3 + 2 + 0
    expect(emblemSum([])).toBeNull();

    const h = history({ rollingN: 5 });
    expect(h.totalMatches).toBe(3); // 4 fixture matches, 1 canceled
    expect(Array.isArray(h.series.overallWinRate)).toBe(true);
    expect(h.series.overallWinRate.length).toBe(3);
    for (const p of h.series.overallWinRate) expect(p.value).toBeGreaterThanOrEqual(0);
  });

  it('analyzeMatch returns framed factors and stays empty for canceled', () => {
    const killer = getMatch('1787606284'); // 1019s merciless killer game
    const factors = analyzeMatch(killer);
    expect(Array.isArray(factors)).toBe(true);
    for (const x of factors) {
      expect(['for', 'against', 'neutral']).toContain(x.dir);
      expect(['major', 'minor']).toContain(x.weight);
      expect(typeof x.text).toBe('string');
    }
    const canceled = getMatch('1787516875'); // the 46s lobby-DC match
    expect(analyzeMatch(canceled)).toEqual([]);
  });

  it('listMatches self carries emblemScore and opponents carry perks', () => {
    const page = listMatches({ limit: 5 });
    const withEmblems = page.matches.find((m) => m.self?.emblemScore != null);
    expect(withEmblems).toBeTruthy();
    const withOppPerks = page.matches.find((m) => m.opponents.some((o) => (o.perks ?? []).length));
    expect(withOppPerks).toBeTruthy();
  });

  it('listMatches rows carry a compact factors list and a self pipDelta', () => {
    const page = listMatches({ limit: 10 });
    for (const m of page.matches) {
      expect(Array.isArray(m.factors)).toBe(true);
      expect(m.factors.length).toBeLessThanOrEqual(2);
      for (const f of m.factors) expect(f.weight).toBe('major');
      if (m.self && m.self.emblemScore != null) {
        expect([-1, 0, 1, 2]).toContain(m.self.pipDelta);
      }
    }
  });
});

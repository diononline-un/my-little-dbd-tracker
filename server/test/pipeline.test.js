import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ingestPayload } from '../src/ingest-pipeline.js';
import { getMatch } from '../src/repository.js';
import { summary, listMatches, buildAnalytics } from '../src/analytics.js';

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
});

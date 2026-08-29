import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ingestCareer } from '../src/ingest-pipeline.js';
import { latestCareer, careerCategories, careerTrend } from '../src/repository.js';

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/career.sample.json', import.meta.url)),
  'utf8',
);

describe('career snapshot ingest', () => {
  it('stores a snapshot and exposes it by category', () => {
    const res = ingestCareer({ category: 'Regular', body: fixture });
    expect(res.inserted).toBe(true);
    expect(res.availableCategories).toEqual(
      expect.arrayContaining(['Regular', 'Calamari', 'Firefly']),
    );
    expect(res.availableCategories).not.toContain('Total');

    const snap = latestCareer('Regular');
    expect(snap.payload['all-time'].global.survivors.escapeRate).toBeCloseTo(0.338153);
    expect(careerCategories()).toEqual(['Regular']);
  });

  it('dedups on (category, bhvr updatedAt)', () => {
    const res = ingestCareer({ category: 'Regular', body: fixture });
    expect(res.inserted).toBe(false);
  });

  it('adds a new row when BHVR updatedAt advances', () => {
    const advanced = JSON.parse(fixture);
    advanced.updatedAt += 86_400_000;
    advanced.data['all-time'].global.survivors.escapeRate = 0.35;
    const res = ingestCareer({ category: 'Regular', body: advanced });
    expect(res.inserted).toBe(true);

    const trend = careerTrend('Regular', 'all-time', 'survivors.escapeRate');
    expect(trend).toHaveLength(2);
    expect(trend[0].value).toBeCloseTo(0.338153);
    expect(trend[1].value).toBeCloseTo(0.35);
  });
});

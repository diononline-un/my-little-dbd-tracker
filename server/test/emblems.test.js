import { describe, it, expect } from 'vitest';
import {
  emblemPointSum, pipDelta, PIP_BANDS, GRADE_LADDER,
  estimatedGradeFromPips, runGradeTrend,
} from '../src/reference/emblems.js';

const q = (...qualities) => qualities.map((emblem_quality) => ({ emblem_quality }));

describe('emblems — estimated pip/grade model', () => {
  it('sums the 4 emblem qualities to 0..16', () => {
    expect(emblemPointSum(q('Iridescent', 'Iridescent', 'Iridescent', 'Iridescent'))).toBe(16);
    expect(emblemPointSum(q('None', 'None', 'None', 'None'))).toBe(0);
    expect(emblemPointSum(q('Bronze', 'Silver', 'Gold', 'None'))).toBe(6);
    expect(emblemPointSum([])).toBeNull();
    expect(emblemPointSum(null)).toBeNull();
  });

  it('maps the point sum to a pip delta via the documented bands', () => {
    expect(pipDelta(q('None', 'None', 'None', 'None'))).toBe(-1);      // 0
    expect(pipDelta(q('Silver', 'Silver', 'None', 'None'))).toBe(-1);  // 4
    expect(pipDelta(q('Silver', 'Silver', 'Silver', 'None'))).toBe(0); // 6
    expect(pipDelta(q('Gold', 'Gold', 'Gold', 'Silver'))).toBe(1);     // 11
    expect(pipDelta(q('Iridescent', 'Iridescent', 'Gold', 'Silver'))).toBe(1);  // 13
    expect(pipDelta(q('Iridescent', 'Iridescent', 'Iridescent', 'Silver'))).toBe(2); // 14
    expect(pipDelta(q('Iridescent', 'Iridescent', 'Iridescent', 'Iridescent'))).toBe(2); // 16
    expect(pipDelta([])).toBeNull();
  });

  it('bands are contiguous and cover 0..16', () => {
    for (let s = 0; s <= 16; s += 1) {
      expect(PIP_BANDS.find((b) => s <= b.upTo)).toBeDefined();
    }
  });

  it('the ladder has all 20 grades, Ash IV lowest and Iridescent I highest', () => {
    expect(GRADE_LADDER).toHaveLength(20);
    expect(GRADE_LADDER[0].label).toBe('Ash IV');
    expect(GRADE_LADDER[19].label).toBe('Iridescent I');
  });

  it('estimatedGradeFromPips walks the ladder and clamps at 0', () => {
    expect(estimatedGradeFromPips(0).label).toBe('Ash IV');
    expect(estimatedGradeFromPips(-5).label).toBe('Ash IV');
    expect(estimatedGradeFromPips(3).label).toBe('Ash III');
    // Ash tier = 4 levels * 3 pips = 12 to clear into Bronze IV
    expect(estimatedGradeFromPips(12).label).toBe('Bronze IV');
  });

  it('runGradeTrend never drops a grade level on a de-pip', () => {
    const irid = q('Iridescent', 'Iridescent', 'Iridescent', 'Iridescent'); // +2
    const none = q('None', 'None', 'None', 'None');                         // -1
    const trend = runGradeTrend([irid, irid, none, none]);
    expect(trend[1].label).toBe('Ash III');   // 4 pips -> into Ash III (floor 3)
    expect(trend[3].label).toBe('Ash III');   // 2x -1 would be 2 pips, clamped to floor 3
    expect(trend[3].cumPips).toBe(3);
  });

  it('passes through matches with no emblems without moving pips', () => {
    const trend = runGradeTrend([q('Iridescent', 'Iridescent', 'Iridescent', 'Iridescent'), []]);
    expect(trend[1].delta).toBeNull();
    expect(trend[1].cumPips).toBe(trend[0].cumPips);
  });
});

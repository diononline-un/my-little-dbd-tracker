import { describe, it, expect } from 'vitest';
import {
  survivorEscaped, decidedWhere, wonSql,
  SURVIVOR_DOWNED, SURVIVOR_KILLED, LEFT_EARLY, NEUTRAL_OUTCOMES,
} from '../src/reference/outcomes.js';

describe('outcomes — the single win/loss definition', () => {
  it('only "escaped" is a survivor win', () => {
    expect(survivorEscaped('escaped')).toBe(true);
    for (const o of ['died', 'sacrificed', 'dc', 'ragequit', 'surrender_loss']) {
      expect(survivorEscaped(o)).toBe(false);
    }
  });

  it('canceled and surrender_draw are neutral (undecided)', () => {
    expect(survivorEscaped('canceled')).toBeNull();
    expect(survivorEscaped('surrender_draw')).toBeNull();
    expect(survivorEscaped(null)).toBeNull();
    expect(NEUTRAL_OUTCOMES.has('canceled')).toBe(true);
    expect(NEUTRAL_OUTCOMES.has('surrender_draw')).toBe(true);
  });

  it('the sets stay disjoint where they must', () => {
    for (const s of SURVIVOR_KILLED) expect(SURVIVOR_DOWNED.has(s)).toBe(true);
    for (const s of LEFT_EARLY) expect(SURVIVOR_DOWNED.has(s)).toBe(true);
    expect(SURVIVOR_KILLED.has('escaped')).toBe(false);
  });

  it('decidedWhere excludes both neutral outcomes, with and without an alias', () => {
    expect(decidedWhere()).toBe("outcome IS NOT 'canceled' AND outcome IS NOT 'surrender_draw'");
    expect(decidedWhere('m')).toBe("m.outcome IS NOT 'canceled' AND m.outcome IS NOT 'surrender_draw'");
  });

  it('wonSql guards the neutral outcomes before the role branches', () => {
    const sql = wonSql('m');
    expect(sql).toMatch(/m\.outcome IS 'canceled' OR m\.outcome IS 'surrender_draw'/);
    expect(sql.indexOf('surrender_draw')).toBeLessThan(sql.indexOf("self_role = 'survivor'"));
    expect(sql).toContain('m.self_kills >= 3');
  });
});

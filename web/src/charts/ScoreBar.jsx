import { orderedCats, label as catLabel, color as catColor } from '../scoreCats.js';
import { num } from '../api.js';

/**
 * One combined score bar: all 4 categories stacked in their colours on a fixed
 * 0–40k scale with 1k gridlines, legend with absolute values below.
 * `compact` drops the ticks + legend (for per-player rows).
 */
export default function ScoreBar({ post, max = 40000, compact = false }) {
  const cats = orderedCats(post);
  if (!cats.length) return null;
  const total = cats.reduce((a, [, v]) => a + Number(v), 0);
  const ticks = compact ? [] : Array.from({ length: max / 1000 + 1 }, (_, i) => i * 1000);

  return (
    <div className={`score-bar${compact ? ' compact' : ''}`}>
      <div className="score-bar-track" title={`${num(total)} total`}>
        {!compact && ticks.map((t) => (
          <span key={t} className={`score-bar-tick${t % 10000 === 0 ? ' major' : ''}`} style={{ left: `${(t / max) * 100}%` }} />
        ))}
        {cats.map(([k, v]) => (
          <span key={k} className="score-bar-seg" style={{ width: `${(Number(v) / max) * 100}%`, background: catColor(k) }} />
        ))}
      </div>
      {!compact && (
        <div className="score-bar-legend">
          {cats.map(([k, v]) => (
            <span key={k}>
              <i style={{ background: catColor(k) }} />
              {catLabel(k)} <strong>{num(v)}</strong>
            </span>
          ))}
          <span className="score-bar-total">Σ {num(total)}</span>
        </div>
      )}
    </div>
  );
}

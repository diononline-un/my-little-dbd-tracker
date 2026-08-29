import { useState } from 'react';

const PAD = { t: 14, r: 16, b: 30, l: 30 };

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * points: [{ id, name, uses, rate (0–1), role? }]
 * X = usage count, Y = performance rate. Median crosslines split the quadrants:
 * top-right = "played a lot & doing well".
 */
export default function Scatter({ points = [], width = 620, height = 300, yLabel = 'rate' }) {
  const [hover, setHover] = useState(null);
  const pts = points.filter((p) => p.rate != null && p.uses > 0);
  if (pts.length < 2) return <p className="muted">Not enough data yet.</p>;

  const xMax = Math.max(...pts.map((p) => p.uses));
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const sx = (v) => PAD.l + (v / (xMax || 1)) * iw;
  const sy = (v) => PAD.t + ih - v * ih; // rate 0..1

  const mx = median(pts.map((p) => p.uses));
  const my = median(pts.map((p) => p.rate));
  const roles = [...new Set(pts.map((p) => p.role).filter(Boolean))];
  const color = (p) => (roles.length > 1 ? (p.role === 'killer' ? 'var(--s2)' : 'var(--s1)') : 'var(--s1)');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: 420, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={width - PAD.r} y1={sy(f)} y2={sy(f)} stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={PAD.l - 6} y={sy(f)} dy="0.32em" textAnchor="end" fontSize="9" fill="var(--viz-muted)">
              {Math.round(f * 100)}%
            </text>
          </g>
        ))}
        {/* median quadrant guides */}
        <line x1={sx(mx)} x2={sx(mx)} y1={PAD.t} y2={height - PAD.b} stroke="var(--viz-axis)" strokeDasharray="3 3" strokeWidth="1" />
        <line x1={PAD.l} x2={width - PAD.r} y1={sy(my)} y2={sy(my)} stroke="var(--viz-axis)" strokeDasharray="3 3" strokeWidth="1" />
        <text x={PAD.l} y={height - 6} fontSize="9" fill="var(--viz-muted)">← less played</text>
        <text x={width - PAD.r} y={height - 6} fontSize="9" fill="var(--viz-muted)" textAnchor="end">more played →</text>

        {pts.map((p, i) => {
          const r = 4 + Math.min(6, Math.sqrt(p.uses));
          return (
            <g key={i}>
              <circle className="viz-dot" cx={sx(p.uses)} cy={sy(p.rate)} r={r}
                fill={color(p)} fillOpacity="0.55" stroke={color(p)} strokeWidth="1.5"
                style={{ animationDelay: `${i * 0.02}s` }}
                onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
        {/* direct-label the 3 most-played, flipping the anchor near the right edge */}
        {[...pts].sort((a, b) => b.uses - a.uses).slice(0, 3).map((p, i) => {
          const near = sx(p.uses) > width - PAD.r - 90;
          return (
            <text key={i} x={sx(p.uses) + (near ? -8 : 8)} y={sy(p.rate)} dy="0.32em"
              textAnchor={near ? 'end' : 'start'} fontSize="10" fill="var(--text-dim)">
              {p.name}
            </text>
          );
        })}
      </svg>
      <div className="muted" style={{ fontSize: 12, marginTop: 2, minHeight: 18 }}>
        {hover
          ? <>{hover.name}: <strong style={{ color: 'var(--text)' }}>{Math.round(hover.rate * 100)}%</strong> over {hover.uses} {hover.uses === 1 ? 'match' : 'matches'}</>
          : <>Top-right = played a lot and doing well · bottom-right = played a lot, struggling</>}
        {roles.length > 1 && (
          <span style={{ marginLeft: 12 }}>
            <span style={{ color: 'var(--s1)' }}>●</span> survivor <span style={{ color: 'var(--s2)', marginLeft: 8 }}>●</span> killer
          </span>
        )}
      </div>
    </div>
  );
}

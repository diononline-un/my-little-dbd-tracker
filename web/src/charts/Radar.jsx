import { useState } from 'react';

/**
 * series: [{ label, color, axes: [{ label, value }] }]  (all share the same axis order)
 * Keep to 1–2 series; small multiples beat overlays.
 */
export default function Radar({ series = [], size = 210, max }) {
  const [hover, setHover] = useState(null);
  if (!series.length || !series[0].axes?.length) return <p className="muted">No data yet.</p>;

  const short = (s) => (s.length > 6 ? s.slice(0, 4) + '·' : s);
  const axes = series[0].axes.map((a) => short(a.label));
  const n = axes.length;
  const PAD = 42; // room for (abbreviated) labels around the polygon
  const box = size + PAD * 2;
  const cx = box / 2, cy = box / 2, r = size / 2;
  const peak = max ?? Math.max(...series.flatMap((s) => s.axes.map((a) => a.value)), 1);

  const pt = (i, frac) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * r * frac, cy + Math.sin(ang) * r * frac];
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${box} ${box}`} style={{ width: box, maxWidth: '100%' }}>
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <polygon key={i} points={axes.map((_, j) => pt(j, f).join(',')).join(' ')}
            fill="none" stroke="var(--viz-grid)" strokeWidth="1" />
        ))}
        {axes.map((label, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.24);
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--viz-grid)" strokeWidth="1" />
              <text x={lx} y={ly} fontSize="10" fill="var(--viz-muted)"
                textAnchor={Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}
                dominantBaseline="middle">{label}</text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const poly = s.axes.map((a, i) => pt(i, Math.min(1, a.value / peak)).join(',')).join(' ');
          return (
            <g key={si}>
              <polygon className="viz-radar" points={poly} fill={s.color} fillOpacity="0.16"
                stroke={s.color} strokeWidth="2" style={{ animationDelay: `${si * 0.1}s` }} />
              {s.axes.map((a, i) => {
                const [x, y] = pt(i, Math.min(1, a.value / peak));
                return (
                  <circle key={i} cx={x} cy={y} r="3.2" fill={s.color}
                    onMouseEnter={() => setHover({ a: a.label, v: a.value })}
                    onMouseLeave={() => setHover(null)} />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 12, minWidth: 90 }}>
        {series.map((s, i) => (
          <div key={i} className="muted" style={{ marginBottom: 4 }}>
            <span style={{ color: s.color }}>●</span> {s.label}
          </div>
        ))}
        {hover ? (
          <div style={{ marginTop: 8, color: 'var(--text)' }}>{hover.a}: <strong>{hover.v.toLocaleString()}</strong></div>
        ) : (
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
            {series[0].axes.map((a) => (
              <div key={a.label}>{a.label} <span style={{ color: 'var(--text)' }}>{a.value.toLocaleString()}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

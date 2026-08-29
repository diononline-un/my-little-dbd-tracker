import { useMemo, useRef, useState } from 'react';

const SERIES_COLORS = [
  'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)',
  'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)',
];

const PAD = { t: 12, r: 16, b: 26, l: 44 };

/**
 * series: [{ label, points: [{ t (ms), value }] }]
 * One y-axis always (never dual). Crosshair + tooltip on hover.
 */
export default function LineChart({ series = [], height = 220, yFormat = (v) => v, width = 640 }) {
  const ref = useRef(null);
  const [hoverX, setHoverX] = useState(null);

  const model = useMemo(() => {
    const pts = series.flatMap((s) => s.points);
    if (!pts.length) return null;
    const xs = pts.map((p) => p.t);
    const ys = pts.map((p) => p.value);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const pad = (yMax - yMin) * 0.1;
    yMin -= pad; yMax += pad;
    const iw = width - PAD.l - PAD.r;
    const ih = height - PAD.t - PAD.b;
    const sx = (t) => PAD.l + (xMax === xMin ? iw / 2 : ((t - xMin) / (xMax - xMin)) * iw);
    const sy = (v) => PAD.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    return { xMin, xMax, yMin, yMax, iw, ih, sx, sy };
  }, [series, width, height]);

  if (!model) return <p className="muted">No data points yet.</p>;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => model.yMin + ((model.yMax - model.yMin) * i) / ticks);

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    setHoverX(x < PAD.l || x > width - PAD.r ? null : x);
  };

  // nearest point per series to hoverX
  const hover = hoverX == null ? null : series.map((s, i) => {
    let best = null;
    for (const p of s.points) {
      const d = Math.abs(model.sx(p.t) - hoverX);
      if (!best || d < best.d) best = { d, p };
    }
    return best ? { label: s.label, color: SERIES_COLORS[i % 8], ...best.p, px: model.sx(best.p.t), py: model.sy(best.p.value) } : null;
  }).filter(Boolean);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 420, display: 'block' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverX(null)}
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={width - PAD.r} y1={model.sy(v)} y2={model.sy(v)} stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={PAD.l - 8} y={model.sy(v)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--viz-muted)">
              {yFormat(v)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={height - 6} fontSize="10" fill="var(--viz-muted)">
          {new Date(model.xMin).toLocaleDateString()}
        </text>
        <text x={width - PAD.r} y={height - 6} textAnchor="end" fontSize="10" fill="var(--viz-muted)">
          {new Date(model.xMax).toLocaleDateString()}
        </text>

        {series.map((s, i) => {
          const d = s.points
            .slice()
            .sort((a, b) => a.t - b.t)
            .map((p, j) => `${j ? 'L' : 'M'}${model.sx(p.t).toFixed(1)},${model.sy(p.value).toFixed(1)}`)
            .join(' ');
          return <path key={i} d={d} fill="none" stroke={SERIES_COLORS[i % 8]} strokeWidth="2" />;
        })}

        {hoverX != null && (
          <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={height - PAD.b} stroke="var(--viz-axis)" strokeWidth="1" />
        )}
        {hover?.map((h, i) => (
          <circle key={i} cx={h.px} cy={h.py} r="3.5" fill={h.color} stroke="var(--viz-surface)" strokeWidth="2" />
        ))}
      </svg>

      {hover?.length > 0 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {new Date(hover[0].t).toLocaleDateString()} —{' '}
          {hover.map((h, i) => (
            <span key={i} style={{ marginRight: 12 }}>
              <span style={{ color: h.color }}>●</span> {h.label}: {yFormat(h.value)}
            </span>
          ))}
        </div>
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        {series.map((s, i) => (
          <span key={i} style={{ marginRight: 12 }}>
            <span style={{ color: SERIES_COLORS[i % 8] }}>●</span> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

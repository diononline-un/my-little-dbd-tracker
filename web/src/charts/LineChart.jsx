import { useMemo, useRef, useState, useLayoutEffect } from 'react';

const SERIES_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
const PAD = { t: 14, r: 18, b: 28, l: 46 };

/** series: [{ label, points: [{ t (ms), value }] }]. One y-axis. Crosshair + tooltip. */
export default function LineChart({ series = [], height = 220, yFormat = (v) => v, width = 640 }) {
  const ref = useRef(null);
  const pathRefs = useRef([]);
  const [hoverX, setHoverX] = useState(null);

  const model = useMemo(() => {
    const pts = series.flatMap((s) => s.points);
    if (!pts.length) return null;
    const xs = pts.map((p) => p.t);
    const ys = pts.map((p) => p.value);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const p = (yMax - yMin) * 0.12;
    yMin = Math.max(0, yMin - p); yMax += p;
    const iw = width - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
    const sx = (t) => PAD.l + (xMax === xMin ? iw / 2 : ((t - xMin) / (xMax - xMin)) * iw);
    const sy = (v) => PAD.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    return { xMin, xMax, yMin, yMax, iw, ih, sx, sy };
  }, [series, width, height]);

  useLayoutEffect(() => {
    pathRefs.current.forEach((el) => {
      if (el) el.style.setProperty('--len', el.getTotalLength());
    });
  }, [model]);

  if (!model) return <p className="muted">No data points yet.</p>;

  const yTicks = Array.from({ length: 5 }, (_, i) => model.yMin + ((model.yMax - model.yMin) * i) / 4);

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    setHoverX(x < PAD.l || x > width - PAD.r ? null : x);
  };

  const hover = hoverX == null ? null : series.map((s, i) => {
    let best = null;
    for (const pt of s.points) {
      const d = Math.abs(model.sx(pt.t) - hoverX);
      if (!best || d < best.d) best = { d, pt };
    }
    return best && { label: s.label, color: SERIES_COLORS[i % 8], ...best.pt, px: model.sx(best.pt.t), py: model.sy(best.pt.value) };
  }).filter(Boolean);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        ref={ref} viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 420, display: 'block' }}
        onMouseMove={onMove} onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          {series.map((_, i) => (
            <linearGradient key={i} id={`lg${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLORS[i % 8]} stopOpacity="0.18" />
              <stop offset="100%" stopColor={SERIES_COLORS[i % 8]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={width - PAD.r} y1={model.sy(v)} y2={model.sy(v)} stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={PAD.l - 8} y={model.sy(v)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--viz-muted)">{yFormat(v)}</text>
          </g>
        ))}
        <text x={PAD.l} y={height - 7} fontSize="10" fill="var(--viz-muted)">{new Date(model.xMin).toLocaleDateString()}</text>
        <text x={width - PAD.r} y={height - 7} textAnchor="end" fontSize="10" fill="var(--viz-muted)">{new Date(model.xMax).toLocaleDateString()}</text>

        {series.map((s, i) => {
          const sorted = s.points.slice().sort((a, b) => a.t - b.t);
          const line = sorted.map((pt, j) => `${j ? 'L' : 'M'}${model.sx(pt.t).toFixed(1)},${model.sy(pt.value).toFixed(1)}`).join(' ');
          const area = `${line} L${model.sx(sorted.at(-1).t).toFixed(1)},${(height - PAD.b).toFixed(1)} L${model.sx(sorted[0].t).toFixed(1)},${(height - PAD.b).toFixed(1)} Z`;
          return (
            <g key={i}>
              <path d={area} fill={`url(#lg${i})`} />
              <path
                ref={(el) => (pathRefs.current[i] = el)}
                className="viz-line" d={line} fill="none"
                stroke={SERIES_COLORS[i % 8]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
              {sorted.map((pt, j) => (
                <circle key={j} className="viz-dot" cx={model.sx(pt.t)} cy={model.sy(pt.value)} r="3"
                  fill={SERIES_COLORS[i % 8]} stroke="var(--viz-surface)" strokeWidth="1.5"
                  style={{ animationDelay: `${0.3 + j * 0.05}s` }} />
              ))}
            </g>
          );
        })}

        {hoverX != null && <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={height - PAD.b} stroke="var(--viz-axis)" strokeWidth="1" />}
        {hover?.map((h, i) => (
          <circle key={i} cx={h.px} cy={h.py} r="4" fill={h.color} stroke="var(--viz-surface)" strokeWidth="2" />
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
      {series.length > 1 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {series.map((s, i) => (
            <span key={i} style={{ marginRight: 12 }}>
              <span style={{ color: SERIES_COLORS[i % 8] }}>●</span> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Horizontal stacked bars for a distribution (e.g. emblem qualities per emblem).
 * rows: [{ label, segments: [{ key, label, value, color }] }]
 * Ordinal order is the caller's responsibility (pass segments low→high).
 */
export default function StackedBar({ rows = [], showLegend = true }) {
  if (!rows.length) return <p className="muted">No data yet.</p>;
  const legend = rows[0].segments;

  return (
    <div>
      {rows.map((row) => {
        const total = row.segments.reduce((a, s) => a + s.value, 0) || 1;
        return (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <div style={{ width: 92, color: 'var(--text-dim)', fontSize: 12, textAlign: 'right' }}>{row.label}</div>
            <div style={{ flex: 1, display: 'flex', height: 16, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
              {row.segments.map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}
                  style={{ width: `${(s.value / total) * 100}%`, background: s.color, minWidth: s.value ? 2 : 0 }}
                />
              ))}
            </div>
            <div style={{ width: 44, fontSize: 12, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {total}
            </div>
          </div>
        );
      })}
      {showLegend && (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {legend.map((s) => (
            <span key={s.key} style={{ marginRight: 12 }}>
              <span style={{ color: s.color }}>■</span> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

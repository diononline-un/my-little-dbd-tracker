/**
 * Contribution-style calendar. days: [{ day: 'YYYY-MM-DD', matches, wins, bp }]
 * Colour intensity = matches played that day.
 */
const CELL = 12, GAP = 3;

export default function Heatmap({ days = [] }) {
  if (!days.length) return <p className="muted">No activity yet.</p>;

  const byDay = new Map(days.map((d) => [d.day, d]));
  const max = Math.max(...days.map((d) => d.matches), 1);

  // build a grid from ~18 weeks ago to today, week columns, Mon–Sun rows
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7 * 18);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday

  const weeks = [];
  let cur = new Date(start);
  while (cur <= end) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const iso = cur.toISOString().slice(0, 10);
      const d = byDay.get(iso);
      col.push({ iso, d, future: cur > end });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(col);
  }

  const level = (m) => (m == null ? 0 : Math.ceil((m / max) * 4));
  const colors = ['#171717', 'rgba(139,0,0,0.35)', 'rgba(139,0,0,0.6)', 'rgba(198,40,40,0.8)', '#e04b4b'];

  const w = weeks.length * (CELL + GAP);
  const h = 7 * (CELL + GAP) + 16;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: Math.min(w, 760), maxWidth: '100%' }}>
        {weeks.map((col, ci) =>
          col.map((cell, ri) => {
            if (cell.future) return null;
            const m = cell.d?.matches;
            return (
              <rect key={`${ci}-${ri}`} x={ci * (CELL + GAP)} y={ri * (CELL + GAP)}
                width={CELL} height={CELL} rx="2"
                fill={colors[level(m)]}
                stroke="rgba(255,255,255,0.04)"
                title={m ? `${cell.iso}: ${m} matches, ${cell.d.wins} wins` : `${cell.iso}: no matches`}>
              </rect>
            );
          }),
        )}
        {weeks.map((col, ci) => {
          const first = col[0];
          if (!first) return null;
          const dt = new Date(first.iso);
          if (dt.getDate() > 7) return null; // label near month start
          return (
            <text key={ci} x={ci * (CELL + GAP)} y={h - 4} fontSize="9" fill="var(--viz-muted)">
              {dt.toLocaleString('en', { month: 'short' })}
            </text>
          );
        })}
      </svg>
      <div className="muted" style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
        less {colors.map((c, i) => <span key={i} style={{ width: 10, height: 10, background: c, display: 'inline-block', borderRadius: 2 }} />)} more
      </div>
    </div>
  );
}

/** { current, currentType: 'win'|'loss', best, worst } */
export default function StreakBadge({ label, s }) {
  if (!s) return null;
  const isWin = s.currentType === 'win';
  return (
    <div className={`streak-badge ${isWin ? 'win' : 'loss'}`}>
      <div className="streak-label">{label}</div>
      <div className="streak-value">
        {s.current}
        <span className="streak-unit">{isWin ? 'W' : 'L'}</span>
      </div>
      <div className="streak-sub muted">
        best {s.best}W{s.worst ? ` · worst ${s.worst}L` : ''}
      </div>
    </div>
  );
}

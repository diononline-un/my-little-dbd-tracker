import { useQuery } from '@tanstack/react-query';
import { api, pct, num } from '../api.js';
import LineChart from '../charts/LineChart.jsx';

const PANELS = [
  { key: 'combined', title: 'Escape & kill rate', fmt: pct, series: [
    { s: 'escapeRate', label: 'Escape rate' },
    { s: 'killRate', label: 'Kill rate (3K+)' },
  ] },
  { key: 'overallWinRate', title: 'Overall win rate', fmt: pct, series: [{ s: 'overallWinRate', label: 'Win rate' }] },
  { key: 'avgBloodpoints', title: 'Bloodpoints per match', fmt: (v) => num(Math.round(v)), series: [{ s: 'avgBloodpoints', label: 'Avg BP' }] },
  { key: 'emblemScore', title: 'Emblem score (0–16, pip proxy)', fmt: (v) => v.toFixed(1), series: [{ s: 'emblemScore', label: 'Emblem score' }] },
];

/**
 * Rolling trends computed straight from tracked match history — available
 * immediately, no BHVR snapshot needed. `only` picks a subset of panels.
 */
export default function HistoryTrends({ rollingN = 15, only }) {
  const { data, isLoading } = useQuery({
    queryKey: ['history', rollingN],
    queryFn: () => api.history({ rollingN }),
  });

  const panels = only ? PANELS.filter((p) => only.includes(p.key)) : PANELS;
  const total = data?.totalMatches ?? 0;

  if (isLoading) return <p className="muted">Loading…</p>;
  if (total < 4) {
    return <p className="muted">Need a handful of tracked matches before a trend is meaningful — keep the collector running.</p>;
  }

  return (
    <>
      <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
        {rollingN}-match rolling average over your {total} tracked matches. It's a live estimate —
        the more matches you accumulate, the smoother and more accurate it gets.
      </p>
      {panels.map((p) => {
        const series = p.series
          .map((s) => ({ label: s.label, points: (data.series[s.s] ?? []).map((pt) => ({ t: pt.t, value: pt.value })) }))
          .filter((s) => s.points.length >= 2);
        return (
          <div className="panel-block" key={p.key}>
            <div className="section-label">{p.title}</div>
            {series.length ? <LineChart series={series} yFormat={p.fmt} /> : <p className="muted">Not enough matches of this kind yet.</p>}
          </div>
        );
      })}
    </>
  );
}

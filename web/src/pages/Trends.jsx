import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, pct, num } from '../api.js';
import LineChart from '../charts/LineChart.jsx';
import HistoryTrends from '../components/HistoryTrends.jsx';

const PANELS = [
  {
    title: 'Survivor escape rate',
    role: 'survivors',
    metrics: [{ metric: 'escapeRate', label: 'Escape rate' }],
    fmt: (v) => pct(v),
  },
  {
    title: 'Killer kill rate & hooks',
    role: 'killers',
    metrics: [
      { metric: 'avgKillRate', label: 'Kill rate' },
    ],
    fmt: (v) => pct(v),
  },
  {
    title: 'Avg bloodpoints per match',
    role: 'general',
    metrics: [{ metric: 'avgBPEarnedPerMatch', label: 'Avg BP' }],
    fmt: (v) => num(Math.round(v)),
  },
];

function TrendPanel({ panel, category, window }) {
  const { data, isLoading } = useQuery({
    queryKey: ['trend', category, window, panel.role, panel.metrics.map((m) => m.metric).join()],
    queryFn: () =>
      api.careerTrend({
        category,
        window,
        role: panel.role,
        metrics: panel.metrics.map((m) => m.metric).join(','),
      }),
  });

  const series = (data?.series ?? []).map((s) => ({
    label: panel.metrics.find((m) => m.metric === s.metric)?.label ?? s.metric,
    points: s.points,
  }));
  const totalPoints = series.reduce((a, s) => a + s.points.length, 0);

  return (
    <div className="panel-block">
      <div className="section-label">{panel.title}</div>
      {isLoading && <p className="muted">Loading…</p>}
      {!isLoading && totalPoints < 2 && (
        <p className="muted">
          Need at least two daily snapshots to draw a trend — keep the collector running.
        </p>
      )}
      {totalPoints >= 2 && <LineChart series={series} yFormat={panel.fmt} />}
    </div>
  );
}

export default function Trends() {
  const [cat, setCat] = useState('Regular');
  const [win, setWin] = useState('all-time');
  const career = useQuery({ queryKey: ['career', cat], queryFn: () => api.career({ category: cat }) });

  return (
    <>
      <h2>Trends</h2>

      <div className="section-label">From your tracked matches</div>
      <HistoryTrends rollingN={15} />

      <div className="section-label" style={{ marginTop: 28 }}>BHVR career snapshots</div>
      <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
        BHVR's own aggregate stats, one snapshot each time they refresh (~daily). These lines
        fill in over the weeks the collector runs — need at least two snapshots to draw.
      </p>

      <div className="tabs">
        {(career.data?.availableCategories ?? [{ id: 'Regular', label: 'Regular Trials' }]).map((c) => (
          <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
        <span className="spacer" />
        {['30-days', 'all-time'].map((x) => (
          <button key={x} className={win === x ? 'active' : ''} onClick={() => setWin(x)}>
            {x === '30-days' ? 'Last 30 days' : 'All time'}
          </button>
        ))}
      </div>

      {PANELS.map((p) => (
        <TrendPanel key={p.title} panel={p} category={cat} window={win} />
      ))}
    </>
  );
}

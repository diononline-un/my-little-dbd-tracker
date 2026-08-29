import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, pct, pct0, num } from '../api.js';

function Bar({ rate, danger = 0.4 }) {
  return (
    <div className="bar">
      <span className={rate != null && rate < danger ? 'low' : ''} style={{ width: `${(rate ?? 0) * 100}%` }} />
    </div>
  );
}

function RateTable({ rows, cols }) {
  if (!rows?.length) return <p className="muted">Not enough data yet.</p>;
  return (
    <table>
      <thead>
        <tr>{cols.map((c) => <th key={c.key} style={c.w ? { width: c.w } : undefined}>{c.h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{cols.map((c) => <td key={c.key}>{c.render(r)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const TABS = {
  'vs-killers': {
    label: 'Vs Killers',
    hint: 'Your escape rate as survivor, by the killer you faced.',
    q: () => api.killers(),
    pick: (d) => d.killers,
    cols: [
      { key: 'n', h: 'Killer', render: (r) => r.killerName ?? r.killerId ?? '—' },
      { key: 'm', h: 'Matches', render: (r) => r.matches },
      { key: 'r', h: 'Escape', render: (r) => pct(r.escapeRate) },
      { key: 'b', h: '', w: 160, render: (r) => <Bar rate={r.escapeRate} /> },
    ],
  },
  'my-killers': {
    label: 'My Killers',
    hint: 'How you do with each killer you play.',
    q: () => api.selfKillers(),
    pick: (d) => d.killers,
    cols: [
      { key: 'n', h: 'Killer', render: (r) => r.killerName ?? r.killerId ?? '—' },
      { key: 'm', h: 'Matches', render: (r) => r.matches },
      { key: 'w', h: 'Win (3K+)', render: (r) => pct(r.winRate) },
      { key: 'k', h: 'Avg kills', render: (r) => r.avgKills?.toFixed(2) ?? '—' },
      { key: 'b', h: '', w: 160, render: (r) => <Bar rate={r.winRate} danger={0.5} /> },
    ],
  },
  maps: {
    label: 'Maps',
    hint: 'Per-map performance. Survivor rows show escape rate, killer rows show 3K+ win rate.',
    q: () => api.maps(),
    pick: (d) => d.maps,
    cols: [
      { key: 'n', h: 'Map', render: (r) => r.mapName ?? r.mapId },
      { key: 'role', h: 'Role', render: (r) => r.role },
      { key: 'm', h: 'Matches', render: (r) => r.matches },
      { key: 'r', h: 'Rate', render: (r) => pct(r.role === 'survivor' ? r.escapeRate : r.killerWinRate) },
      { key: 'b', h: '', w: 160, render: (r) => <Bar rate={r.role === 'survivor' ? r.escapeRate : r.killerWinRate} danger={r.role === 'survivor' ? 0.4 : 0.5} /> },
    ],
  },
  builds: {
    label: 'Builds',
    hint: 'Your escape rate by a perk you were running (survivor).',
    q: () => api.builds({ minMatches: 2 }),
    pick: (d) => d.builds,
    cols: [
      { key: 'n', h: 'Perk', render: (r) => r.perkName ?? r.perkId },
      { key: 'm', h: 'Matches', render: (r) => r.matches },
      { key: 'r', h: 'Escape', render: (r) => pct(r.escapeRate) },
      { key: 'b', h: '', w: 160, render: (r) => <Bar rate={r.escapeRate} /> },
    ],
  },
  'perk-pairs': {
    label: 'Perk pairs',
    hint: 'Escape rate for pairs of your own perks (survivor).',
    q: () => api.perkPairs({ minMatches: 2 }),
    pick: (d) => d.pairs,
    cols: [
      { key: 'n', h: 'Pair', render: (r) => r.perks.map((p) => p.name || p.id).join(' + ') },
      { key: 'm', h: 'Matches', render: (r) => r.matches },
      { key: 'r', h: 'Escape', render: (r) => pct(r.escapeRate) },
      { key: 'b', h: '', w: 160, render: (r) => <Bar rate={r.escapeRate} /> },
    ],
  },
  offerings: {
    label: 'Offerings',
    hint: 'Escape / win rate by the offering you burned.',
    q: () => api.offerings({ minMatches: 2 }),
    pick: (d) => d.offerings,
    cols: [
      { key: 'n', h: 'Offering', render: (r) => r.offeringName ?? r.offeringId },
      { key: 'role', h: 'Role', render: (r) => r.role },
      { key: 'm', h: 'Matches', render: (r) => r.matches },
      { key: 'r', h: 'Rate', render: (r) => pct(r.rate) },
      { key: 'b', h: '', w: 160, render: (r) => <Bar rate={r.rate} danger={r.role === 'survivor' ? 0.4 : 0.5} /> },
    ],
  },
  teammates: {
    label: 'Teammates',
    hint: 'Your escape rate when a random teammate ran a given perk (solo-queue).',
    q: () => api.teammates({ minMatches: 2 }),
    pick: (d) => d.teammates,
    cols: [
      { key: 'n', h: 'Teammate perk', render: (r) => r.perkName ?? r.perkId },
      { key: 'm', h: 'Matches', render: (r) => r.matches },
      { key: 'r', h: 'Your escape', render: (r) => pct(r.selfEscapeRateWhenPresent) },
      { key: 'b', h: '', w: 160, render: (r) => <Bar rate={r.selfEscapeRateWhenPresent} /> },
    ],
  },
};

export default function Analytics() {
  const [tab, setTab] = useState('vs-killers');
  const t = TABS[tab];
  const { data, isLoading, error } = useQuery({ queryKey: ['an', tab], queryFn: t.q });

  return (
    <>
      <h2>Analytics</h2>
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {Object.entries(TABS).map(([k, v]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v.label}</button>
        ))}
      </div>
      <p className="muted">{t.hint}</p>
      {error && <p className="warn">{String(error.message)}</p>}
      {isLoading ? <p className="muted">Loading…</p> : <RateTable rows={t.pick(data ?? {})} cols={t.cols} />}
    </>
  );
}

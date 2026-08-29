import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, pct, num } from '../api.js';

function Delta({ v, invert = false, suffix = '' }) {
  if (v == null || v === 0) return null;
  // "good" = up, unless invert (e.g. losses). Red only when worse.
  const worse = invert ? v > 0 : v < 0;
  const arrow = v > 0 ? '▲' : '▼';
  return (
    <span style={{ fontSize: 11, marginLeft: 6, color: worse ? 'var(--blood-bright)' : 'var(--good)' }}>
      {arrow} {Math.abs(v) < 1 && v !== 0 ? `${Math.round(Math.abs(v) * 100)}pp` : num(Math.abs(Math.round(v)))}{suffix}
    </span>
  );
}

function Cell({ k, v, delta }) {
  return (
    <div className="recap-cell">
      <div className="recap-k">{k}</div>
      <div className="recap-v">{v}{delta}</div>
    </div>
  );
}

export default function RecapCard() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useQuery({ queryKey: ['recap', offset], queryFn: () => api.recap({ offset }) });

  const c = data?.current;
  const d = data?.delta ?? {};
  const label = offset === 0 ? 'This week' : offset === 1 ? 'Last week' : `${offset} weeks ago`;

  return (
    <div className="panel-block anim-rise" style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="section-label" style={{ margin: 0 }}>Recap · {label}</div>
        <span className="spacer" />
        <button className="pager" onClick={() => setOffset((o) => o + 1)}>‹ older</button>
        <button className="pager" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}>newer ›</button>
      </div>

      {isLoading && <p className="muted" style={{ marginTop: 10 }}>Loading…</p>}
      {c && c.matches === 0 && <p className="muted" style={{ marginTop: 10 }}>No matches in this week.</p>}
      {c && c.matches > 0 && (
        <div className="recap-grid">
          <Cell k="Matches" v={c.matches} delta={<Delta v={d.matches} />} />
          <Cell k="Record" v={`${c.wins}–${c.losses}`} delta={<Delta v={d.wins} />} />
          <Cell k="Win rate" v={pct(c.winRate)} delta={<Delta v={d.winRate} />} />
          <Cell k="Best streak" v={`${c.bestStreak}W`} delta={<Delta v={d.bestStreak} />} />
          <Cell k="Bloodpoints" v={num(c.bp)} delta={<Delta v={d.bp} />} />
          <Cell k="Avg BP / match" v={num(c.avgBp)} delta={<Delta v={d.avgBp} />} />
          <Cell k="Most played killer" v={c.mostPlayedKiller ?? '—'} />
          <Cell k="Most faced killer" v={c.mostFacedKiller ?? '—'} />
          <Cell k="Top perk" v={c.topPerk ?? '—'} />
        </div>
      )}
    </div>
  );
}

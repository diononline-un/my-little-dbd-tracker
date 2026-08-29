import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, pct, num } from '../api.js';
import { GameIcon, charIcon, perkIcon } from '../icons.jsx';
import Radar from '../charts/Radar.jsx';
import Heatmap from '../charts/Heatmap.jsx';

function KillerMeta() {
  const { data } = useQuery({ queryKey: ['killerMeta'], queryFn: api.killerMeta });
  const rows = (data?.killers ?? []).slice(0, 14);
  if (!rows.length) return <p className="muted">No survivor matches yet.</p>;
  const max = Math.max(...rows.map((r) => r.faced), 1);
  return (
    <div className="stagger">
      {rows.map((r) => (
        <div key={r.killerId} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '5px 0' }}>
          <GameIcon src={charIcon(r.killerId, 'killer')} alt={r.killerName} size={26} rounded={4} />
          <span style={{ width: 128, color: 'var(--text-dim)', fontSize: 13 }}>{r.killerName ?? r.killerId}</span>
          <div style={{ flex: 1 }} className="bar">
            <span style={{ width: `${(r.faced / max) * 100}%` }} />
          </div>
          <span style={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.faced}×</span>
          <span style={{ width: 52, textAlign: 'right', color: 'var(--text-dim)', fontSize: 12 }}>{pct(r.escapeRate)}</span>
        </div>
      ))}
    </div>
  );
}

function OpponentPerks() {
  const [role, setRole] = useState('survivor');
  const { data } = useQuery({ queryKey: ['oppPerks', role], queryFn: () => api.opponentPerks({ role }) });
  const rows = data?.perks ?? [];
  const max = Math.max(...rows.map((r) => r.matches), 1);
  return (
    <>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={role === 'survivor' ? 'active' : ''} onClick={() => setRole('survivor')}>Other survivors</button>
        <button className={role === 'killer' ? 'active' : ''} onClick={() => setRole('killer')}>Killers</button>
      </div>
      {!rows.length && <p className="muted">Not enough data yet.</p>}
      <div className="stagger">
        {rows.map((r) => (
          <div key={r.perkId} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '5px 0' }}>
            <GameIcon src={perkIcon(r.perkId)} alt={r.perkName} size={24} rounded={4} />
            <span style={{ width: 190, fontSize: 13 }}>{r.perkName ?? r.perkId}</span>
            <div style={{ flex: 1 }} className="bar"><span style={{ width: `${(r.matches / max) * 100}%` }} /></div>
            <span style={{ width: 90, textAlign: 'right', color: 'var(--text-dim)', fontSize: 12 }}>
              {r.matches} matches
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Insights() {
  const sp = useQuery({ queryKey: ['scoreProfile'], queryFn: api.scoreProfile });
  const act = useQuery({ queryKey: ['activity'], queryFn: () => api.activity({ days: 130 }) });

  const survRadar = sp.data?.survivor?.length
    ? [{ label: 'Survivor', color: 'var(--s1)', axes: sp.data.survivor.map((c) => ({ label: c.label, value: c.avg })) }]
    : [];
  const killRadar = sp.data?.killer?.length
    ? [{ label: 'Killer', color: 'var(--s2)', axes: sp.data.killer.map((c) => ({ label: c.label, value: c.avg })) }]
    : [];

  return (
    <>
      <h2>Insights</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div className="panel-block" style={{ marginTop: 0 }}>
          <div className="section-label">Survivor score profile · avg / match</div>
          {survRadar.length ? <Radar series={survRadar} /> : <p className="muted">No survivor matches with score data yet.</p>}
        </div>
        <div className="panel-block" style={{ marginTop: 0 }}>
          <div className="section-label">Killer score profile · avg / match</div>
          {killRadar.length ? <Radar series={killRadar} /> : <p className="muted">No killer matches with score data yet.</p>}
        </div>
      </div>

      <div className="panel-block">
        <div className="section-label">Activity · last ~18 weeks</div>
        <Heatmap days={act.data?.days ?? []} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <div className="panel-block" style={{ marginTop: 0 }}>
          <div className="section-label">Killers you face most (survivor)</div>
          <KillerMeta />
        </div>
        <div className="panel-block" style={{ marginTop: 0 }}>
          <div className="section-label">Perks the opposition runs</div>
          <OpponentPerks />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
        Everything here is derived from your tracked match history — it grows as the collector runs.
        BHVR's API exposes only the last 50 matches and daily career aggregates, nothing more, so the
        depth comes from accumulating over time. <Link to="/matches" className="muted">view matches →</Link>
      </p>
    </>
  );
}

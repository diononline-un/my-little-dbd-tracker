import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, when } from '../api.js';
import { GameIcon, charIcon } from '../icons.jsx';
import StreakBadge from '../components/StreakBadge.jsx';

function Leaderboard({ rows, role }) {
  if (!rows?.length) return <p className="muted">No {role} matches tracked yet.</p>;
  const max = Math.max(...rows.map((r) => r.best), 1);
  return (
    <table>
      <thead>
        <tr><th>{role === 'killer' ? 'Killer' : 'Survivor'}</th><th>Best</th><th>Current</th><th>Matches</th><th>Last played</th><th style={{ width: 140 }} /></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.characterId}>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <GameIcon src={charIcon(r.characterId, role)} alt={r.characterName} size={26} rounded={4} />
                {r.characterName ?? r.characterId}
              </span>
            </td>
            <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-bright)' }}>{r.best}W</td>
            <td className={r.currentType === 'loss' ? 'warn' : ''} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {r.current}{r.currentType === 'win' ? 'W' : r.currentType === 'loss' ? 'L' : ''}
            </td>
            <td>{r.matches}</td>
            <td className="muted">{when(r.lastPlayedAt)}</td>
            <td><div className="bar"><span style={{ width: `${(r.best / max) * 100}%` }} /></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Streaks() {
  const [role, setRole] = useState('killer');
  const s = useQuery({ queryKey: ['streaks'], queryFn: api.streaks });
  const cs = useQuery({ queryKey: ['characterStreaks'], queryFn: api.characterStreaks });

  const onFire = [...(cs.data?.killers ?? []), ...(cs.data?.survivors ?? [])]
    .filter((e) => e.currentType === 'win' && e.current >= 3)
    .sort((a, b) => b.current - a.current);

  return (
    <>
      <h2>Streaks</h2>

      {s.data && (
        <div className="streak-row" style={{ marginBottom: 14 }}>
          <StreakBadge label="Current streak" s={s.data.overall} />
          <StreakBadge label="Survivor best" s={{ ...s.data.survivor, current: s.data.survivor.best, currentType: 'win' }} />
          <StreakBadge label="Killer best" s={{ ...s.data.killer, current: s.data.killer.best, currentType: 'win' }} />
        </div>
      )}

      {s.data?.estimatedGrade && (
        <p className="muted" style={{ marginTop: -6, fontSize: 12.5 }}>
          Estimated grade — survivor <strong>{s.data.estimatedGrade.survivor ?? '—'}</strong>,
          {' '}killer <strong>{s.data.estimatedGrade.killer ?? '—'}</strong>
          {' '}<span style={{ opacity: 0.7 }}>(derived from emblem qualities; BHVR exposes no real pips)</span>
        </p>
      )}

      {onFire.length > 0 && (
        <div className="panel-block" style={{ marginTop: 0 }}>
          <div className="section-label">On fire</div>
          {onFire.map((e) => (
            <div key={`${e.role}-${e.characterId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
              <GameIcon src={charIcon(e.characterId, e.role)} alt={e.characterName} size={24} rounded={4} />
              <span>{e.current}W streak as <strong>{e.characterName}</strong> <span className="muted">({e.role})</span></span>
            </div>
          ))}
        </div>
      )}

      <div className="tabs" style={{ marginTop: 16 }}>
        <button className={role === 'killer' ? 'active' : ''} onClick={() => setRole('killer')}>Killers</button>
        <button className={role === 'survivor' ? 'active' : ''} onClick={() => setRole('survivor')}>Survivors</button>
      </div>
      <p className="muted">Best and current win streak with each character you play.</p>
      <Leaderboard rows={role === 'killer' ? cs.data?.killers : cs.data?.survivors} role={role} />
    </>
  );
}

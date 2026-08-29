import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api, dur, when } from '../api.js';

function Players({ players }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Slot</th><th>Role</th><th>Character</th><th>P</th>
          <th>Perks</th><th>Add-ons</th><th>Offering</th><th>Item / Power</th>
          <th>BP</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id} style={p.is_self ? { color: 'var(--text-bright)' } : undefined}>
            <td>{p.slot}{p.is_self ? ' (you)' : ''}</td>
            <td>{p.role}</td>
            <td>{p.character_name ?? p.character_id ?? '—'}</td>
            <td>{p.prestige ?? '—'}</td>
            <td className="muted">{(p.perks ?? []).map((x) => x.name || x.id).join(', ') || '—'}</td>
            <td className="muted">{(p.addons ?? []).map((x) => x.name || x.id).join(', ') || '—'}</td>
            <td className="muted">{p.offering_name ?? '—'}</td>
            <td className="muted">{p.power_name ?? '—'}</td>
            <td>{p.bloodpoints?.toLocaleString() ?? '—'}</td>
            <td>{p.status ?? p.killer_grade ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function MatchDetail() {
  const { matchId } = useParams();
  const { data: m, isLoading, error } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => api.match(matchId),
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error) return <p className="warn">{String(error.message)}</p>;

  return (
    <>
      <p><Link to="/matches" className="muted">← all matches</Link></p>
      <h2>
        {m.map_name ?? m.map_id} · {dur(m.duration_seconds)}
        {m.is_corrected && <> <span className="flag">Entity-corrected</span></>}
      </h2>
      <p className="muted">
        {when(m.played_at)} · {m.self_role} · {m.game_mode}
        {m.special_event_id ? ` · event ${m.special_event_id}` : ''} · outcome: {m.outcome}
      </p>

      {m.is_corrected && (
        <div style={{ margin: '14px 0' }}>
          <strong className="warn">Entity Corrector notes</strong>
          {(m.correctionNotes ?? m.correction_notes ?? []).map((n, i) => (
            <div className="note" key={i}>
              <strong>{n.rule}</strong> — {n.reason}
            </div>
          ))}
        </div>
      )}

      <Players players={m.players} />
    </>
  );
}

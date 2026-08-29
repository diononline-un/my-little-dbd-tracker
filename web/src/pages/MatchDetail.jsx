import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api, dur, when, num, QUALITY_COLORS } from '../api.js';

function Emblems({ list }) {
  if (!list?.length) return <span className="muted">—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {list.map((e, i) => (
        <span key={i} title={`${e.emblem_name}: ${e.emblem_quality}`}
          style={{ width: 10, height: 10, borderRadius: 2, background: QUALITY_COLORS[e.emblem_quality] ?? 'var(--q-none)' }} />
      ))}
    </span>
  );
}

function ScoreBreakdown({ post }) {
  if (!post) return <span className="muted">—</span>;
  return (
    <span className="muted" style={{ fontSize: 12 }}>
      {Object.entries(post).map(([k, v]) => `${k.split('_').pop()} ${num(v)}`).join(' · ')}
    </span>
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

  const notes = m.correctionNotes ?? m.correction_notes ?? [];

  return (
    <>
      <p><Link to="/matches" className="muted">← all matches</Link></p>
      <h2>
        {m.map_name ?? m.map_id ?? 'Unknown map'} · {dur(m.duration_seconds)}
        {m.is_corrected && <> <span className="flag">Entity-corrected</span></>}
      </h2>
      <p className="muted">
        {when(m.played_at)} · {m.self_role} · {m.game_mode}
        {m.special_event_id ? ` · event ${m.special_event_id}` : ''} · outcome: {m.outcome}
        {m.self_kills != null ? ` · ${m.self_kills} kills` : ''}
      </p>

      {notes.length > 0 && (
        <div style={{ margin: '14px 0' }}>
          <strong className="warn">Entity Corrector</strong>
          {notes.map((n, i) => (
            <div className="note" key={i}><strong>{n.rule}</strong> — {n.reason}</div>
          ))}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Slot</th><th>Role</th><th>Character</th><th>P</th><th>Lvl</th>
            <th>Perks</th><th>Add-ons</th><th>Offering</th><th>Item / Power</th>
            <th>Emblems</th><th>BP</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {m.players.map((p) => (
            <tr key={p.id} style={p.is_self ? { color: 'var(--text-bright)' } : undefined}>
              <td>{p.slot}{p.is_self ? ' · you' : ''}</td>
              <td>{p.role}</td>
              <td>{p.character_name ?? p.character_id ?? '—'}</td>
              <td>{p.prestige ?? '—'}</td>
              <td className="muted">{p.character_level ?? '—'}</td>
              <td className="muted">{(p.perks ?? []).map((x) => x.name || x.id).join(', ') || '—'}</td>
              <td className="muted">{(p.addons ?? []).map((x) => x.name || x.id).join(', ') || '—'}</td>
              <td className="muted">{p.offering_name ?? '—'}</td>
              <td className="muted">{p.power_name ?? '—'}</td>
              <td><Emblems list={p.emblems} /></td>
              <td>{p.bloodpoints?.toLocaleString() ?? '—'}</td>
              <td>{p.status ?? p.killer_grade ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="panel-block">
        <div className="section-label">Score categories</div>
        {m.players.filter((p) => p.post_game_stat).map((p) => (
          <div key={p.id} style={{ margin: '4px 0' }}>
            <span style={{ display: 'inline-block', width: 130 }}>
              {p.character_name ?? p.character_id}{p.is_self ? ' · you' : ''}
            </span>
            <ScoreBreakdown post={p.post_game_stat} />
          </div>
        ))}
      </div>
    </>
  );
}

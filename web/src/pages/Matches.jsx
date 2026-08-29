import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, dur, when, QUALITY_COLORS } from '../api.js';

function ScoreCats({ post }) {
  if (!post) return <span className="muted">—</span>;
  const entries = Object.entries(post);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end', height: 16 }}>
      {entries.map(([k, v]) => (
        <span
          key={k}
          title={`${k.split('_').pop()}: ${v.toLocaleString()}`}
          style={{ width: 5, height: `${(v / max) * 16}px`, background: 'var(--s1)', display: 'inline-block' }}
        />
      ))}
    </span>
  );
}

function Emblems({ list }) {
  if (!list?.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {list.map((e, i) => (
        <span
          key={i}
          title={`${e.emblem_name}: ${e.emblem_quality}`}
          style={{ width: 8, height: 8, borderRadius: 2, background: QUALITY_COLORS[e.emblem_quality] ?? 'var(--q-none)' }}
        />
      ))}
    </span>
  );
}

export default function Matches() {
  const [f, setF] = useState({ role: '', corrected: '', killerId: '', mapId: '', limit: 40, offset: 0 });
  const set = (patch) => setF((x) => ({ ...x, offset: 0, ...patch }));

  const { data, isLoading, error } = useQuery({
    queryKey: ['matches', f],
    queryFn: () => api.matches(f),
    placeholderData: (prev) => prev,
  });
  const killers = useQuery({ queryKey: ['an', 'vs-killers'], queryFn: () => api.killers() });
  const maps = useQuery({ queryKey: ['an', 'maps'], queryFn: () => api.maps() });

  return (
    <>
      <h2>Match history</h2>
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        <select value={f.role} onChange={(e) => set({ role: e.target.value })}>
          <option value="">All roles</option>
          <option value="survivor">Survivor</option>
          <option value="killer">Killer</option>
        </select>
        <select value={f.corrected} onChange={(e) => set({ corrected: e.target.value })}>
          <option value="">Corrected &amp; clean</option>
          <option value="true">Corrected only</option>
          <option value="false">Clean only</option>
        </select>
        <select value={f.killerId} onChange={(e) => set({ killerId: e.target.value })}>
          <option value="">Any killer</option>
          {(killers.data?.killers ?? []).map((k) => (
            <option key={k.killerId} value={k.killerId}>{k.killerName ?? k.killerId}</option>
          ))}
        </select>
        <select value={f.mapId} onChange={(e) => set({ mapId: e.target.value })}>
          <option value="">Any map</option>
          {[...new Map((maps.data?.maps ?? []).map((m) => [m.mapId, m.mapName])).entries()].map(([id, name]) => (
            <option key={id} value={id}>{name ?? id}</option>
          ))}
        </select>
      </div>

      {error && <p className="warn">{String(error.message)}</p>}
      {isLoading && <p className="muted">Loading…</p>}

      {data && (
        <>
          <table>
            <thead>
              <tr>
                <th>When</th><th>Role</th><th>Map</th><th>Killer</th><th>Char</th>
                <th>Dur</th><th>Result</th><th>Emblems</th><th>Score</th><th>BP</th><th />
              </tr>
            </thead>
            <tbody>
              {data.matches.map((m) => (
                <tr key={m.match_id}>
                  <td>{when(m.played_at)}</td>
                  <td>{m.self_role}</td>
                  <td>{m.map_name ?? m.map_id ?? '—'}</td>
                  <td>{m.killer_name ?? '—'}</td>
                  <td className="muted">{m.self?.character_name ?? '—'}{m.self?.prestige ? ` P${m.self.prestige}` : ''}</td>
                  <td>{dur(m.duration_seconds)}</td>
                  <td>
                    {m.outcome}
                    {m.is_corrected && <> <span className="flag">corrected</span></>}
                  </td>
                  <td><Emblems list={m.self?.emblems} /></td>
                  <td><ScoreCats post={m.self?.post_game_stat} /></td>
                  <td>{m.self_bloodpoints?.toLocaleString() ?? '—'}</td>
                  <td><Link to={`/matches/${m.match_id}`} className="muted">→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 12 }}>
            {data.total} matches ·{' '}
            <button className="pager" disabled={f.offset === 0} onClick={() => setF((x) => ({ ...x, offset: Math.max(0, x.offset - x.limit) }))}>prev</button>{' '}
            <button className="pager" disabled={f.offset + f.limit >= data.total} onClick={() => setF((x) => ({ ...x, offset: x.offset + x.limit }))}>next</button>
          </p>
        </>
      )}
    </>
  );
}

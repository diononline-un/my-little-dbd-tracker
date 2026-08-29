import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import MatchCard from '../components/MatchCard.jsx';

export default function Matches() {
  const [f, setF] = useState({ role: '', corrected: '', killerId: '', mapId: '', limit: 25, offset: 0 });
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
          <div className="stagger">
            {data.matches.map((m) => <MatchCard key={m.match_id} m={m} />)}
          </div>
          {data.matches.length === 0 && <p className="muted">No matches for this filter.</p>}
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

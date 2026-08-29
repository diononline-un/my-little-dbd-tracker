import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, dur, when } from '../api.js';

export default function Matches() {
  const [filters, setFilters] = useState({ role: '', corrected: '', limit: 50, offset: 0 });
  const { data, isLoading, error } = useQuery({
    queryKey: ['matches', filters],
    queryFn: () => api.matches(filters),
    keepPreviousData: true,
  });

  const set = (patch) => setFilters((f) => ({ ...f, offset: 0, ...patch }));

  return (
    <>
      <h2>Match history</h2>
      <div className="tabs">
        <select value={filters.role} onChange={(e) => set({ role: e.target.value })}>
          <option value="">All roles</option>
          <option value="survivor">Survivor</option>
          <option value="killer">Killer</option>
        </select>
        <select value={filters.corrected} onChange={(e) => set({ corrected: e.target.value })}>
          <option value="">Corrected & clean</option>
          <option value="true">Corrected only</option>
          <option value="false">Clean only</option>
        </select>
      </div>

      {error && <p className="warn">{String(error.message)}</p>}
      {isLoading && <p className="muted">Loading…</p>}

      {data && (
        <>
          <table>
            <thead>
              <tr>
                <th>When</th><th>Role</th><th>Map</th><th>Killer</th>
                <th>Duration</th><th>Result</th><th>BP</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.matches.map((m) => (
                <tr key={m.match_id}>
                  <td>{when(m.played_at)}</td>
                  <td>{m.self_role}</td>
                  <td>{m.map_name ?? m.map_id}</td>
                  <td>{m.killer_name ?? '—'}</td>
                  <td>{dur(m.duration_seconds)}</td>
                  <td>
                    {m.outcome}
                    {m.is_corrected && <> <span className="flag">corrected</span></>}
                  </td>
                  <td>{m.self_bloodpoints?.toLocaleString() ?? '—'}</td>
                  <td><Link to={`/matches/${m.match_id}`} className="muted">details →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 12 }}>
            {data.total} matches ·{' '}
            <button
              className="flag"
              style={{ cursor: 'pointer', background: 'none' }}
              disabled={filters.offset === 0}
              onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
            >
              prev
            </button>{' '}
            <button
              className="flag"
              style={{ cursor: 'pointer', background: 'none' }}
              disabled={filters.offset + filters.limit >= data.total}
              onClick={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
            >
              next
            </button>
          </p>
        </>
      )}
    </>
  );
}

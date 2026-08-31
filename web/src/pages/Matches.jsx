import { useState, useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import MatchCard from '../components/MatchCard.jsx';

const PAGE = 25;

export default function Matches() {
  const [f, setF] = useState({ role: '', corrected: '', killerId: '', mapId: '' });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const sentinel = useRef(null);

  const {
    data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['matches', f],
    queryFn: ({ pageParam = 0 }) => api.matches({ ...f, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((a, p) => a + p.matches.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const matches = data?.pages.flatMap((p) => p.matches) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const avgScoreByRole = data?.pages[0]?.avgScoreByRole;

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
            {matches.map((m) => (
              <MatchCard key={m.match_id} m={m} avg={avgScoreByRole?.[m.self_role]} />
            ))}
          </div>
          {matches.length === 0 && <p className="muted">No matches for this filter.</p>}
          <div ref={sentinel} />
          <p className="muted" style={{ marginTop: 12 }}>
            {isFetchingNextPage ? 'Loading more…' : `${matches.length} of ${total} matches`}
          </p>
        </>
      )}
    </>
  );
}

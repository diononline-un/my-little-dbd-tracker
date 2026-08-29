import { useQuery } from '@tanstack/react-query';
import { api, pct } from '../api.js';

function Tile({ k, v, neg }) {
  return (
    <div className="tile">
      <div className="k">{k}</div>
      <div className={`v${neg ? ' neg' : ''}`}>{v}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['summary'], queryFn: api.summary });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error) return <p className="warn">Backend unreachable: {String(error.message)}</p>;

  const s = data;
  const survLow = s.survivor.escapeRate != null && s.survivor.escapeRate < 0.4;
  const killLow = s.killer.winRate != null && s.killer.winRate < 0.5;

  return (
    <>
      <h2>Overview</h2>
      <div className="grid cols-4">
        <Tile k="Matches tracked" v={s.totalMatches} />
        <Tile k="Corrected by Entity" v={s.correctedMatches} neg={s.correctedMatches > 0} />
        <Tile k="Canceled (excluded)" v={s.canceledMatches} />
        <Tile k="Total bloodpoints" v={s.totalBloodpoints.toLocaleString()} />
      </div>

      <div className="grid cols-3" style={{ marginTop: 14 }}>
        <Tile k="Survivor escape rate" v={pct(s.survivor.escapeRate)} neg={survLow} />
        <Tile k="Killer win rate (3K+)" v={pct(s.killer.winRate)} neg={killLow} />
        <Tile
          k="Avg kills / killer match"
          v={s.killer.avgKills == null ? '—' : s.killer.avgKills.toFixed(2)}
        />
      </div>

      <p className="muted" style={{ marginTop: 20 }}>
        {s.survivor.matches} survivor matches · {s.killer.matches} killer matches counted
        toward rates (canceled lobbies excluded).
      </p>
    </>
  );
}

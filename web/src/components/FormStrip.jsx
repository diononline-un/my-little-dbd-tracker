import { Link } from 'react-router-dom';
import { dur } from '../api.js';

/** matches: [{ match_id, won, self_role, killer_name, map_name, outcome }] newest-first */
export default function FormStrip({ matches = [] }) {
  if (!matches.length) return <span className="muted">no decided matches yet</span>;
  // newest-first, left→right — matches the rest of the Overview (streaks, recent feed)
  return (
    <div className="form-strip">
      <span className="form-edge">now</span>
      {matches.map((m) => (
        <Link
          key={m.match_id}
          to={`/matches/${m.match_id}`}
          className={`form-dot ${m.won ? 'w' : 'l'}`}
          title={`${m.self_role} · ${m.map_name ?? ''}${m.killer_name ? ` vs ${m.killer_name}` : ''} · ${m.outcome}`}
        >
          {m.won ? 'W' : 'L'}
        </Link>
      ))}
      <span className="form-edge">older</span>
    </div>
  );
}

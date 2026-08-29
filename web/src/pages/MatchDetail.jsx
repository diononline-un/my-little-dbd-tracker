import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import MatchDetailBody from '../components/MatchDetailBody.jsx';

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
      <MatchDetailBody match={m} />
    </>
  );
}

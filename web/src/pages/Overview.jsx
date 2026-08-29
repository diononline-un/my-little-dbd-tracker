import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, pct } from '../api.js';
import StreakBadge from '../components/StreakBadge.jsx';
import FormStrip from '../components/FormStrip.jsx';
import RecapCard from '../components/RecapCard.jsx';
import HistoryTrends from '../components/HistoryTrends.jsx';
import MatchCard from '../components/MatchCard.jsx';

function Tile({ k, v, sub, neg }) {
  return (
    <div className="tile">
      <div className="k">{k}</div>
      <div className={`v${neg ? ' neg' : ''}`}>{v}</div>
      {sub != null && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Overview() {
  const tracked = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const streak = useQuery({ queryKey: ['streaks'], queryFn: api.streaks });
  const form = useQuery({ queryKey: ['form', 20], queryFn: () => api.form({ limit: 20 }) });
  const recent = useQuery({ queryKey: ['matches', { limit: 4, page: 'overview' }], queryFn: () => api.matches({ limit: 4 }) });

  return (
    <>
      <h2>Overview</h2>

      {/* --- quick pulse: streaks + recent form --- */}
      {streak.data && (
        <div className="streak-row" style={{ marginBottom: 16 }}>
          <StreakBadge label="Current streak" s={streak.data.overall} />
          <StreakBadge label="Survivor" s={streak.data.survivor} />
          <StreakBadge label="Killer" s={streak.data.killer} />
          <div className="streak-badge" style={{ flex: '2 1 260px' }}>
            <div className="streak-label">
              Recent form{form.data ? ` · ${form.data.wins}–${form.data.losses} (last ${form.data.matches.length})` : ''}
              {' '}<Link to="/streaks" className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>see all →</Link>
            </div>
            <div style={{ marginTop: 10 }}>
              <FormStrip matches={form.data?.matches ?? []} />
            </div>
          </div>
        </div>
      )}

      {/* --- the last few matches, in full --- */}
      <div className="section-label">
        Recent matches <Link to="/matches" className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>all matches →</Link>
      </div>
      {recent.isLoading && <p className="muted">Loading…</p>}
      {recent.data?.matches?.length === 0 && <p className="muted">No matches tracked yet.</p>}
      <div className="stagger">
        {(recent.data?.matches ?? []).map((m) => (
          <MatchCard key={m.match_id} m={m} avg={recent.data.avgScoreByRole?.[m.self_role]} />
        ))}
      </div>

      {/* --- this week's recap --- */}
      <div style={{ marginTop: 20 }}>
        <RecapCard />
      </div>

      {/* --- tracked-data totals --- */}
      <div className="section-label" style={{ marginTop: 22 }}>Tracked by EntityTrack</div>
      {tracked.data && (
        <div className="grid cols-4 stagger">
          <Tile k="Matches tracked" v={tracked.data.totalMatches} sub={`${tracked.data.canceledMatches} canceled`} />
          <Tile
            k="Entity-corrected"
            v={tracked.data.correctedMatches}
            neg={tracked.data.correctedMatches > 0}
            sub={<Link to="/matches?corrected=true" className="muted">view</Link>}
          />
          <Tile k="Survivor escape" v={pct(tracked.data.survivor.escapeRate)} sub={`${tracked.data.survivor.matches} matches`} />
          <Tile
            k="Killer win (3K+)"
            v={pct(tracked.data.killer.winRate)}
            sub={`${tracked.data.killer.matches} matches · ${tracked.data.killer.avgKills?.toFixed(2) ?? '—'} avg kills`}
          />
        </div>
      )}

      {/* --- rolling form trend --- */}
      <div className="section-label" style={{ marginTop: 22 }}>
        Form trend <Link to="/trends" className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>more →</Link>
      </div>
      <HistoryTrends only={['combined']} rollingN={10} />
    </>
  );
}

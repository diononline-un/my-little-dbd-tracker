import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, pct, pct0, num, hrs, QUALITY_COLORS, QUALITY_ORDER } from '../api.js';
import StackedBar from '../charts/StackedBar.jsx';

function Tile({ k, v, sub, neg }) {
  return (
    <div className="tile">
      <div className="k">{k}</div>
      <div className={`v${neg ? ' neg' : ''}`}>{v}</div>
      {sub != null && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function emblemRows(emblems) {
  if (!emblems) return [];
  return Object.entries(emblems).map(([id, byQuality]) => ({
    label: id.split('_').pop(),
    segments: QUALITY_ORDER.map((q) => ({
      key: q,
      label: q,
      value: byQuality[q] ?? 0,
      color: QUALITY_COLORS[q],
    })),
  }));
}

export default function Overview() {
  const [cat, setCat] = useState('Regular');
  const [win, setWin] = useState('all-time');

  const tracked = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const career = useQuery({ queryKey: ['career', cat], queryFn: () => api.career({ category: cat }) });

  const w = career.data?.windows?.[win];
  const surv = w?.survivors;
  const kill = w?.killers;
  const gen = w?.general;

  return (
    <>
      <h2>Overview</h2>

      {/* --- our own tracked data --- */}
      <div className="section-label">Tracked by EntityTrack</div>
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

      {/* --- BHVR career stats --- */}
      <div className="section-label" style={{ marginTop: 26 }}>
        Career (BHVR){' '}
        {career.data?.bhvrUpdatedAt && (
          <span className="muted">· updated {new Date(career.data.bhvrUpdatedAt).toLocaleDateString()}</span>
        )}
      </div>

      <div className="tabs">
        {(career.data?.availableCategories ?? [{ id: 'Regular', label: 'Regular Trials' }]).map((c) => (
          <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        {['30-days', 'all-time'].map((x) => (
          <button key={x} className={win === x ? 'active' : ''} onClick={() => setWin(x)}>
            {x === '30-days' ? 'Last 30 days' : 'All time'}
          </button>
        ))}
      </div>

      {!career.data?.windows && (
        <p className="muted">
          No career snapshot yet — the collector extension pulls these on its next run.
        </p>
      )}

      {w && (
        <>
          <div className="grid cols-4 stagger">
            <Tile k="Hours played" v={hrs(gen?.totalHoursPlayed)} sub={`${num(gen?.totalMatchesPlayed)} matches`} />
            <Tile k="Avg BP / match" v={num(Math.round(gen?.avgBPEarnedPerMatch ?? 0))} />
            <Tile k="Escape rate" v={pct(surv?.escapeRate)} sub={`${num(surv?.matchesEscaped)} escapes`} neg={surv?.escapeRate != null && surv.escapeRate < 0.35} />
            <Tile k="Kill rate" v={pct(kill?.avgKillRate)} sub={`${num(kill?.totalKills)} kills · ${kill?.avgHooks?.toFixed(1) ?? '—'} avg hooks`} />
          </div>

          <div className="grid cols-3 stagger" style={{ marginTop: 12 }}>
            <Tile k="Survivor · chases won" v={num(surv?.survivorChasesWon)} sub={`longest ${Math.round(surv?.survivorLongestChaseTimeInSeconds ?? 0)}s`} />
            <Tile k="Survivor · heals" v={num(surv?.survivorSuccessfullyHealed)} sub={`hooked ${num(surv?.survivorTimesHooked)}×`} />
            <Tile k="Killer · pallets / gens / walls" v={`${num(kill?.totalPalletsDestroyed)} / ${num(kill?.totalGenKicked)} / ${num(kill?.totalWallsBroken)}`} />
          </div>

          {surv?.emblems && Object.keys(surv.emblems).length > 0 && (
            <div className="panel-block">
              <div className="section-label">Survivor emblems</div>
              <StackedBar rows={emblemRows(surv.emblems)} />
            </div>
          )}
          {kill?.emblems && Object.keys(kill.emblems).length > 0 && (
            <div className="panel-block">
              <div className="section-label">Killer emblems</div>
              <StackedBar rows={emblemRows(kill.emblems)} />
            </div>
          )}
        </>
      )}
    </>
  );
}

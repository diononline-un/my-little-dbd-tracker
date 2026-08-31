import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, pct, num, hrs, QUALITY_COLORS, QUALITY_ORDER } from '../api.js';
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
    segments: QUALITY_ORDER.map((q) => ({ key: q, label: q, value: byQuality[q] ?? 0, color: QUALITY_COLORS[q] })),
  }));
}

/** BHVR's own aggregate career stats — per game mode, 30-day / all-time. */
export default function CareerPanel() {
  const [cat, setCat] = useState('Regular');
  const [win, setWin] = useState('all-time');
  const career = useQuery({ queryKey: ['career', cat], queryFn: () => api.career({ category: cat }) });

  const w = career.data?.windows?.[win];
  const surv = w?.survivors;
  const kill = w?.killers;
  const gen = w?.general;

  return (
    <>
      <div className="section-label">
        Career (BHVR){' '}
        {career.data?.bhvrUpdatedAt && (
          <span className="muted">· updated {new Date(career.data.bhvrUpdatedAt).toLocaleDateString()}</span>
        )}
      </div>

      <div className="tabs">
        {(career.data?.availableCategories ?? [{ id: 'Regular', label: 'Regular Trials' }]).map((c) => (
          <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
        <span className="spacer" />
        {['30-days', 'all-time'].map((x) => (
          <button key={x} className={win === x ? 'active' : ''} onClick={() => setWin(x)}>
            {x === '30-days' ? 'Last 30 days' : 'All time'}
          </button>
        ))}
      </div>

      {!career.data?.windows && (
        <p className="muted">No career snapshot yet — the collector pulls these on its next run.</p>
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
            <Tile k="Survivor · heals" v={num(surv?.survivorSuccessfullyHealed)} sub={`hooked ${num(surv?.survivorTimesHooked)}× · avg ${surv?.avgTimesHooked?.toFixed(1) ?? '—'}`} />
            <Tile k="Killer · pallets / gens / walls" v={`${num(kill?.totalPalletsDestroyed)} / ${num(kill?.totalGenKicked)} / ${num(kill?.totalWallsBroken)}`} />
          </div>

          <div className="grid cols-3 stagger" style={{ marginTop: 12 }}>
            <Tile k="Killer · total hits / hooks" v={`${num(kill?.totalHits)} / ${num(kill?.totalHooks)}`} sub={`${num(kill?.totalChasesWon)} chases won`} />
            <Tile k="Survivor time" v={hrs(surv?.totalHoursPlayed)} sub={`${num(surv?.totalMatchesPlayed)} matches · ${num(Math.round(surv?.avgBPEarnedPerMatch ?? 0))} avg BP`} />
            <Tile k="Killer time" v={hrs(kill?.totalHoursPlayed)} sub={`${num(kill?.totalMatchesPlayed)} matches · ${num(Math.round(kill?.avgBPEarnedPerMatch ?? 0))} avg BP`} />
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

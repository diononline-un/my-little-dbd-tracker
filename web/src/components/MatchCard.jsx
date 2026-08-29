import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, dur, when, kfmt, orderedCats } from '../api.js';
import {
  GameIcon, PlayerPortrait, charIcon, mapIcon, perkIcon, addonIcon, offeringIcon, itemIcon, veIcon,
} from '../icons.jsx';
import MatchDetailBody from './MatchDetailBody.jsx';
import { SURVIVOR_ESCAPED as GOOD, SURVIVOR_DOWNED as BAD } from '../outcomes.js';

const CAT_LABEL = (k) => k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');
const CAT_SHORT = (k) => CAT_LABEL(k).slice(0, 3);
const score = (p) => p?.leaderboardScore ?? null;

const CAT_COLOR = {
  Objectives: 'var(--s1)', Altruism: 'var(--s3)', Boldness: 'var(--s4)', Survival: 'var(--s5)',
  Hunter: 'var(--s1)', Deviousness: 'var(--s7)', Brutality: 'var(--s2)', Sacrifice: 'var(--s8)',
};

/** Score categories in a fixed order, k-rounded, with a small colour dot each. */
function ScoreLine({ post, compact }) {
  const cats = orderedCats(post);
  if (!cats.length) return null;
  return (
    <div className={`score-line${compact ? ' compact' : ''}`}>
      {cats.map(([k, v]) => (
        <span key={k}>
          <i style={{ background: CAT_COLOR[CAT_LABEL(k)] ?? 'var(--text-dim)' }} />
          {compact ? CAT_SHORT(k) : CAT_LABEL(k)} {kfmt(v)}
        </span>
      ))}
    </div>
  );
}

function Diamond({ src, alt, title, size = 26 }) {
  return (
    <span className="perk-diamond" style={{ width: size, height: size }} title={title ?? alt}>
      <GameIcon src={src} alt={alt} size={size * 0.82} rounded={0} />
    </span>
  );
}

function LoadoutRow({ self }) {
  const perks = self.perks ?? [];
  const addons = self.addons ?? [];
  return (
    <div className="match-loadout">
      <span className="ld-perks">
        {[0, 1, 2, 3].map((i) =>
          perks[i]
            ? <Diamond key={i} src={perkIcon(perks[i].id)} alt={perks[i].name} title={perks[i].name} />
            : <span key={i} className="perk-diamond empty" style={{ width: 26, height: 26 }} />,
        )}
      </span>
      {self.offering_id && (
        <GameIcon src={offeringIcon(self.offering_id)} alt={self.offering_name} title={self.offering_name} size={24} rounded={4} />
      )}
      {(self.power_id || addons.length > 0) && (
        <span className="ld-gear">
          {self.power_id && (
            <GameIcon src={itemIcon(self.power_id)} alt={self.power_name} title={self.power_name} size={24} rounded={4} />
          )}
          <span className="ld-plus">+</span>
          {[0, 1].map((i) =>
            addons[i]
              ? <GameIcon key={i} src={addonIcon(addons[i].id)} alt={addons[i].name} title={addons[i].name} size={24} rounded={4} />
              : <span key={i} className="slot-empty" />,
          )}
        </span>
      )}
    </div>
  );
}

function OppTile({ o }) {
  const isKiller = o.role === 'killer';
  const perks = o.perks ?? [];
  return (
    <div className={`opp-tile${isKiller ? ' opp-killer' : ''}`}>
      <div className="opp-tile-head">
        <PlayerPortrait characterId={o.character_id} role={o.role} name={o.character_name}
          status={isKiller ? null : o.status} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="opp-name">
            {o.character_name ?? o.character_id ?? '—'}
            {o.prestige ? <span className="muted"> P{o.prestige}</span> : null}
          </div>
          <div className="opp-nums">
            {score(o) != null && <strong>{score(o).toLocaleString()}</strong>}
            <span className="muted"> {o.bloodpoints?.toLocaleString() ?? '—'} BP</span>
          </div>
        </div>
        {isKiller && (
          <span className="opp-tag" title={o.killer_grade ?? 'Killer'}>{(o.killer_grade ?? 'KILLER').replace(' KILLER', '')}</span>
        )}
      </div>
      <div className="opp-perks">
        {[0, 1, 2, 3].map((j) =>
          perks[j]
            ? <GameIcon key={j} src={perkIcon(perks[j].id)} alt={perks[j].name} title={perks[j].name} size={28} rounded={4} />
            : <span key={j} className="opp-perk-empty" />,
        )}
      </div>
      <ScoreLine post={o.post_game_stat} />
    </div>
  );
}

export default function MatchCard({ m, avg }) {
  const [open, setOpen] = useState(false);
  const self = m.self ?? {};
  const isKiller = m.self_role === 'killer';

  const portrait = self.character_id
    ? charIcon(self.character_id, m.self_role)
    : m.killer_id && charIcon(m.killer_id, 'killer');

  const outcomeBad = BAD.has(m.outcome);
  const outcomeLabel = isKiller
    ? (m.self_kills != null ? `${m.self_kills} / 4 kills` : (m.self_grade ?? 'killer').replace(' KILLER', ''))
    : (GOOD.has(m.outcome) ? 'Escaped' : (m.outcome ?? '').replace('_', ' '));
  const bigScore = score(self) ?? m.self_bloodpoints;
  const selfDowned = !isKiller && BAD.has(m.outcome);
  const selfStatus = isKiller ? null : m.outcome;

  const scoreDelta = avg && bigScore != null ? bigScore - avg : null;

  const detail = useQuery({
    queryKey: ['match', m.match_id],
    queryFn: () => api.match(m.match_id),
    enabled: open,
  });

  const mapUrl = mapIcon(m.map_id);
  const headStyle = mapUrl
    ? { backgroundImage: `linear-gradient(90deg, #101010 22%, rgba(16,16,16,0.82) 52%, rgba(16,16,16,0.45) 100%), url(${mapUrl})` }
    : undefined;

  return (
    <div className={`match-card${m.is_corrected ? ' is-corrected' : ''}${open ? ' is-open' : ''}`}>
      <div className="match-card-head" role="button" tabIndex={0} style={headStyle}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o))}>

        <div className="match-top">
          <div className="match-portrait">
            {portrait && <img src={portrait} alt={self.character_name ?? ''} loading="lazy"
              className={selfDowned ? 'pp-dim' : ''} />}
            {selfStatus && veIcon(selfStatus) && (
              <img className="pp-status" src={veIcon(selfStatus)} alt={selfStatus} style={{ width: 56, height: 56 }} />
            )}
            <div className={`outcome${outcomeBad ? ' bad' : ''}`}>{outcomeLabel}</div>
          </div>

          <div className="match-body">
            <div className="match-name">
              <span className={`role-badge ${isKiller ? 'killer' : 'survivor'}`}>
                {isKiller ? 'Killer' : 'Survivor'}
              </span>
              {self.character_name ?? (isKiller ? m.killer_name : '—')}
              {self.prestige ? <span className="muted" style={{ fontWeight: 400 }}> · P{self.prestige}</span> : null}
              {m.deathPosition && m.deathPosition !== 'survived' && (
                <span className="match-chip">{m.deathPosition}</span>
              )}
              {m.is_corrected && <> <span className="flag">corrected</span></>}
            </div>
            <div className="match-scorelabel">
              Score
              {scoreDelta != null && (
                <span className={`emblem-score${scoreDelta < 0 ? ' warn' : ''}`}>
                  {' '}· {scoreDelta >= 0 ? '+' : ''}{scoreDelta.toLocaleString()} vs your avg
                </span>
              )}
              {self.emblemScore != null && (
                <span className="emblem-score" title="Emblem score (0–16) — sum of your 4 emblem qualities. BHVR exposes no pips; this is the closest proxy.">
                  {' '}· emblems {self.emblemScore}/16
                </span>
              )}
            </div>
            <div className="match-score">
              {bigScore?.toLocaleString() ?? '—'}
              <span className="match-bp"> · {m.self_bloodpoints?.toLocaleString() ?? '—'} BP</span>
            </div>
            {m.vsKiller && m.vsKiller.faced > 1 && (
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                vs {m.killer_name}: faced {m.vsKiller.faced}× · escaped {m.vsKiller.escapes}
              </div>
            )}
            <LoadoutRow self={self} />
            <ScoreLine post={self.post_game_stat} />
          </div>

          <div className="match-meta">
            <div className="dur">{dur(m.duration_seconds)}</div>
            <div className="map">{m.map_name ?? m.map_id ?? 'Unknown map'}</div>
            <div className="muted">{when(m.played_at)}</div>
          </div>
        </div>

        {m.opponents?.length > 0 && (
          <div className="match-opps">
            <div className="match-opps-label">{isKiller ? 'Survivors' : 'Your team & killer'}</div>
            <div className="match-opps-grid">
              {m.opponents.map((o, i) => <OppTile key={i} o={o} />)}
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="match-expand">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Link to={`/matches/${m.match_id}`} className="muted" style={{ fontSize: 12 }}>open full page ↗</Link>
          </div>
          {detail.isLoading && <p className="muted">Loading…</p>}
          {detail.error && <p className="warn">{String(detail.error.message)}</p>}
          {detail.data && <MatchDetailBody match={detail.data} showHeader={false} />}
        </div>
      )}
    </div>
  );
}

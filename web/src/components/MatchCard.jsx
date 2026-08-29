import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, dur, when } from '../api.js';
import {
  GameIcon, PlayerPortrait, charIcon, mapIcon, perkIcon, addonIcon, offeringIcon, itemIcon,
} from '../icons.jsx';
import MatchDetailBody from './MatchDetailBody.jsx';

const GOOD = new Set(['escaped', 'surrender_draw']);
const BAD = new Set(['died', 'sacrificed', 'dc', 'ragequit', 'surrender_loss']);
const CAT_LABEL = (k) => k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');
const CAT_SHORT = (k) => CAT_LABEL(k).slice(0, 3);
const score = (p) => p?.leaderboardScore ?? null;

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
  const cats = o.post_game_stat ? Object.entries(o.post_game_stat) : [];
  return (
    <div className={`opp-tile${isKiller ? ' opp-killer' : ''}`}>
      <div className="opp-tile-head">
        <PlayerPortrait characterId={o.character_id} role={o.role} name={o.character_name}
          status={isKiller ? null : o.status} size={40} />
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
            ? <GameIcon key={j} src={perkIcon(perks[j].id)} alt={perks[j].name} title={perks[j].name} size={20} rounded={3} />
            : <span key={j} className="opp-perk-empty" />,
        )}
      </div>
      {cats.length > 0 && (
        <div className="opp-cats">
          {cats.map(([k, v]) => (
            <span key={k} title={`${CAT_LABEL(k)}: ${v.toLocaleString()}`}>
              <span className="muted">{CAT_SHORT(k)}</span> {v.toLocaleString()}
            </span>
          ))}
        </div>
      )}
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
  const cats = self.post_game_stat ? Object.entries(self.post_game_stat) : [];
  const bigScore = score(self) ?? m.self_bloodpoints;
  const selfDead = m.self_role === 'survivor' && BAD.has(m.outcome) && m.outcome !== 'surrender_loss';

  // result strip: killer → kills/4 red; survivor → per-survivor escaped(green)/died(red)
  const strip = isKiller
    ? Array.from({ length: 4 }, (_, i) => (i < (m.self_kills ?? 0) ? 'k' : 'e'))
    : [self, ...(m.opponents ?? []).filter((o) => o.role === 'survivor')]
        .slice(0, 4)
        .map((p) => (['escaped', 'surrender_draw'].includes(p === self ? m.outcome : p.status) ? 'e'
          : ['dc', 'ragequit'].includes(p.status) ? 'o' : 'd'));

  const scoreDelta = avg && bigScore != null ? bigScore - avg : null;

  const detail = useQuery({
    queryKey: ['match', m.match_id],
    queryFn: () => api.match(m.match_id),
    enabled: open,
  });

  return (
    <div
      className={`match-card${m.is_corrected ? ' is-corrected' : ''}${open ? ' is-open' : ''}`}
      style={isKiller && m.self_kills ? { '--kill-tint': (m.self_kills / 4) * 0.14 } : undefined}
    >
      <div className={`result-strip ${isKiller ? 'killer' : 'survivor'}`}>
        {strip.map((s, i) => <span key={i} className={`rs rs-${s}`} />)}
      </div>
      <div className="match-card-head" role="button" tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o))}>

        <div className="match-top">
          <div className="match-portrait">
            {portrait && <img src={portrait} alt={self.character_name ?? ''} loading="lazy"
              className={selfDead ? 'pp-dim' : ''} />}
            {selfDead && <span className="pp-x" style={{ fontSize: '3rem' }}>✕</span>}
            <div className={`outcome${outcomeBad ? ' bad' : ''}`}>{outcomeLabel}</div>
          </div>

          <div className="match-body">
            <div className="match-name">
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
            {cats.length > 0 && (
              <div className="match-cats">
                {cats.map(([k, v]) => (
                  <div className="match-cat" key={k}>
                    <div className="cv">{v.toLocaleString()}</div>
                    <div className="cl">{CAT_LABEL(k)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="match-meta">
            <GameIcon src={mapIcon(m.map_id)} alt={m.map_name} w={140} h={82} rounded={5} />
            <div className="muted" style={{ marginTop: 6 }}>{when(m.played_at)}</div>
            <div className="map">{m.map_name ?? m.map_id ?? 'Unknown'}</div>
            <div className="dur">{dur(m.duration_seconds)}</div>
          </div>
        </div>

        {m.opponents?.length > 0 && (
          <div className="match-opps-grid">
            {m.opponents.map((o, i) => <OppTile key={i} o={o} />)}
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

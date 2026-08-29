import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, dur, when } from '../api.js';
import {
  GameIcon, charIcon, mapIcon, perkIcon, addonIcon, offeringIcon, itemIcon, statusIcon,
} from '../icons.jsx';
import MatchDetailBody from './MatchDetailBody.jsx';

const GOOD = new Set(['escaped', 'surrender_draw']);
const BAD = new Set(['died', 'sacrificed', 'dc', 'ragequit', 'surrender_loss']);
const CAT_LABEL = (k) => k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');
const STATUS_ICON = {
  escaped: 'VE_Escaped', died: 'VE_Killed', sacrificed: 'VE_Sacrificed',
  dc: 'VE_Disconnected', ragequit: 'VE_Disconnected',
  surrender_loss: 'VE_SurrenderDraw', surrender_draw: 'VE_SurrenderDraw',
};

/** A rotated bordered frame with a counter-rotated icon inside — DBD's perk look. */
function Diamond({ src, alt, title, size = 24 }) {
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
            : <span key={i} className="perk-diamond empty" style={{ width: 24, height: 24 }} />,
        )}
      </span>
      {self.offering_id && (
        <GameIcon src={offeringIcon(self.offering_id)} alt={self.offering_name} title={self.offering_name} size={22} rounded={4} />
      )}
      {(self.power_id || addons.length > 0) && (
        <span className="ld-gear">
          {self.power_id && (
            <GameIcon src={itemIcon(self.power_id)} alt={self.power_name} title={self.power_name} size={22} rounded={4} />
          )}
          <span className="ld-plus">+</span>
          {[0, 1].map((i) =>
            addons[i]
              ? <GameIcon key={i} src={addonIcon(addons[i].id)} alt={addons[i].name} title={addons[i].name} size={22} rounded={4} />
              : <span key={i} className="slot-empty" />,
          )}
        </span>
      )}
    </div>
  );
}

function Opponents({ list = [] }) {
  if (!list.length) return null;
  return (
    <div className="match-opps">
      {list.map((o, i) => {
        const isKiller = o.role === 'killer';
        const st = STATUS_ICON[o.status];
        const perks = o.perks ?? [];
        return (
          <div key={i} className={`opp${isKiller ? ' opp-killer' : ''}`}
            title={`${o.character_name ?? ''}${o.prestige ? ` · P${o.prestige}` : ''}${perks.length ? `\n${perks.map((p) => p.name || p.id).join(', ')}` : ''}`}>
            <GameIcon src={charIcon(o.character_id, o.role)} alt={o.character_name} size={44} rounded={4} />
            <div className="opp-bp">
              {o.bloodpoints?.toLocaleString() ?? '—'}
              {isKiller
                ? <span className="opp-role opp-role-killer" title={o.killer_grade ?? 'Killer'}>🗡</span>
                : st && <GameIcon src={statusIcon(st)} alt={o.status} size={11} rounded={2} className="opp-role" />}
            </div>
            <div className="opp-perks">
              {[0, 1, 2, 3].map((j) =>
                perks[j]
                  ? <GameIcon key={j} src={perkIcon(perks[j].id)} alt={perks[j].name} title={perks[j].name} size={12} rounded={2} />
                  : <span key={j} className="opp-perk-empty" />,
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MatchCard({ m }) {
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

  const detail = useQuery({
    queryKey: ['match', m.match_id],
    queryFn: () => api.match(m.match_id),
    enabled: open,
  });

  return (
    <div className={`match-card${m.is_corrected ? ' is-corrected' : ''}${open ? ' is-open' : ''}`}>
      <div className="match-card-head" role="button" tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o))}>
        <div className="match-portrait match-col">
          {portrait && <img src={portrait} alt={self.character_name ?? ''} loading="lazy" />}
          <div className={`outcome${outcomeBad ? ' bad' : ''}`}>{outcomeLabel}</div>
        </div>

        <div className="match-body match-col">
          <div className="match-name">
            {self.character_name ?? (isKiller ? m.killer_name : '—')}
            {self.prestige ? <span className="muted" style={{ fontWeight: 400 }}> · P{self.prestige}</span> : null}
            {m.is_corrected && <> <span className="flag">corrected</span></>}
          </div>
          <div className="match-scorelabel">
            Score
            {self.emblemScore != null && (
              <span className="emblem-score" title="Emblem score (0–16) — sum of your 4 emblem qualities. BHVR exposes no pips; this is the closest proxy.">
                · emblems {self.emblemScore}/16
              </span>
            )}
          </div>
          <div className="match-score">{m.self_bloodpoints?.toLocaleString() ?? '—'}</div>
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

        <div className="match-col match-opps-col">
          <Opponents list={m.opponents} />
        </div>

        <div className="match-meta match-col">
          <GameIcon src={mapIcon(m.map_id)} alt={m.map_name} w={104} h={62} rounded={5} />
          <div className="muted" style={{ marginTop: 6 }}>{when(m.played_at)}</div>
          <div className="map">{m.map_name ?? m.map_id ?? 'Unknown'}</div>
          <div className="dur">{dur(m.duration_seconds)}</div>
        </div>
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

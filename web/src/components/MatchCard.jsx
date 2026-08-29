import { Link } from 'react-router-dom';
import { dur, when } from '../api.js';
import {
  GameIcon, IconRow, charIcon, mapIcon, perkIcon, addonIcon, offeringIcon, itemIcon, emblemIcon,
} from '../icons.jsx';

const GOOD_OUTCOMES = new Set(['escaped', 'surrender_draw']);
const BAD_OUTCOMES = new Set(['died', 'sacrificed', 'dc', 'ragequit', 'surrender_loss']);

const CAT_LABEL = (k) => k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');

export default function MatchCard({ m }) {
  const self = m.self ?? {};
  const isKiller = m.self_role === 'killer';

  // portrait: your character (killer -> killer portrait; survivor -> survivor portrait)
  const portrait = self.character_id
    ? charIcon(self.character_id, m.self_role)
    : m.killer_id && charIcon(m.killer_id, 'killer');

  const loadout = [
    ...(self.perks ?? []).map((p) => ({ key: `p${p.id}`, src: perkIcon(p.id), alt: p.name || p.id, title: p.name })),
  ];
  const gear = [
    self.power_id && { key: 'pow', src: itemIcon(self.power_id), alt: self.power_name, title: self.power_name },
    ...(self.addons ?? []).map((a) => ({ key: `a${a.id}`, src: addonIcon(a.id), alt: a.name || a.id, title: a.name })),
  ].filter(Boolean);
  const offering = self.offering_id
    ? [{ key: 'off', src: offeringIcon(self.offering_id), alt: self.offering_name, title: self.offering_name }]
    : [];

  const cats = self.post_game_stat ? Object.entries(self.post_game_stat) : [];
  const outcomeBad = BAD_OUTCOMES.has(m.outcome);
  const outcomeLabel = isKiller
    ? (m.self_grade ? m.self_grade.replace(' KILLER', '') : m.outcome)
    : m.outcome?.replace('_', ' ');

  return (
    <Link to={`/matches/${m.match_id}`} className={`match-card${m.is_corrected ? ' is-corrected' : ''}`}>
      <div className="match-portrait">
        {portrait && <img src={portrait} alt={self.character_name ?? ''} loading="lazy" />}
        <div className={`outcome${outcomeBad ? ' bad' : ''}`}>
          {isKiller ? `${m.self_kills ?? 0}K` : (GOOD_OUTCOMES.has(m.outcome) ? 'Escaped' : outcomeLabel)}
        </div>
      </div>

      <div className="match-body">
        <div className="match-name">
          {self.character_name ?? (isKiller ? m.killer_name : '—')}
          {self.prestige ? <span className="muted" style={{ fontWeight: 400 }}> · P{self.prestige}</span> : null}
          {m.is_corrected && <> <span className="flag">corrected</span></>}
        </div>
        <div className="match-scorelabel">Score</div>
        <div className="match-score">{m.self_bloodpoints?.toLocaleString() ?? '—'}</div>

        <div className="match-loadout">
          <IconRow items={loadout} size={26} />
          {gear.length > 0 && <span style={{ width: 8 }} />}
          <IconRow items={gear} size={26} />
          {offering.length > 0 && <span style={{ width: 8 }} />}
          <IconRow items={offering} size={26} />
        </div>

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
        <div>{when(m.played_at)}</div>
        <div className="map">{m.map_name ?? m.map_id ?? 'Unknown'}</div>
        <div className="dur">{dur(m.duration_seconds)}</div>
        {!isKiller && m.killer_name && (
          <div className="muted" style={{ marginTop: 4 }}>vs {m.killer_name}</div>
        )}
        {(self.emblems ?? []).length > 0 && (
          <div className="match-emblems">
            {self.emblems.map((e, i) => (
              <GameIcon key={i} src={emblemIcon(e.emblem_id, e.emblem_quality)} alt={`${e.emblem_name} ${e.emblem_quality}`}
                title={`${e.emblem_name}: ${e.emblem_quality}`} size={20} rounded={2} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

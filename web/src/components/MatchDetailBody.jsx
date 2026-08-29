import { dur, when, num } from '../api.js';
import {
  GameIcon, PlayerPortrait, charIcon, mapIcon, perkIcon, addonIcon, offeringIcon, itemIcon, emblemIcon, statusIcon,
} from '../icons.jsx';

const CAT_LABEL = (k) => k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');

const STATUS_ICON = {
  escaped: 'VE_Escaped', died: 'VE_Killed', sacrificed: 'VE_Sacrificed',
  dc: 'VE_Disconnected', ragequit: 'VE_Disconnected',
  surrender_loss: 'VE_SurrenderDraw', surrender_draw: 'VE_SurrenderDraw',
};

function Card({ label, children, wide }) {
  return (
    <div className="panel-block anim-rise" style={{ marginTop: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <div className="section-label">{label}</div>
      {children}
    </div>
  );
}

/** icon + spelled-out label — no hover needed. */
function Named({ src, name }) {
  return (
    <span className="named-item">
      <GameIcon src={src} alt={name ?? ''} size={20} rounded={3} />
      <span>{name ?? '—'}</span>
    </span>
  );
}

function PlayerRow({ p }) {
  const st = STATUS_ICON[p.status] ?? null;
  const perks = p.perks ?? [];
  const addons = p.addons ?? [];
  return (
    <div className={`tally-player${p.is_self ? ' is-self' : ''}`}>
      <div className="tally-head">
        <PlayerPortrait characterId={p.character_id} role={p.role} name={p.character_name}
          status={p.role === 'killer' ? null : p.status} size={38} rounded={5} />
        <span className="tally-name">
          {p.character_name ?? p.character_id ?? '—'}
          {p.is_self ? ' · you' : ''}
          {p.prestige ? <span className="muted"> P{p.prestige}</span> : null}
          {p.character_level ? <span className="muted"> · lvl {p.character_level}</span> : null}
        </span>
        <span className="tally-bp">
          {p.leaderboard_score != null && <strong style={{ color: 'var(--text)' }}>{p.leaderboard_score.toLocaleString()}</strong>}
          {' '}{p.bloodpoints?.toLocaleString() ?? '—'} BP
        </span>
        {st && <GameIcon src={statusIcon(st)} alt={p.status} size={18} rounded={2} />}
        {p.killer_grade && <span className="muted" style={{ fontSize: 11 }}>{p.killer_grade.replace(' KILLER', '')}</span>}
      </div>

      <div className="tally-loadout">
        <div className="tally-line">
          <span className="tally-lbl">Perks</span>
          {perks.length
            ? perks.map((x) => <Named key={x.id} src={perkIcon(x.id)} name={x.name || x.id} />)
            : <span className="muted">— not recorded</span>}
        </div>
        {(p.power_id || addons.length > 0) && (
          <div className="tally-line">
            <span className="tally-lbl">{p.role === 'killer' ? 'Power' : 'Item'}</span>
            {p.power_id && <Named src={itemIcon(p.power_id)} name={p.power_name || p.power_id} />}
            {addons.map((x) => <Named key={x.id} src={addonIcon(x.id)} name={x.name || x.id} />)}
          </div>
        )}
        {p.offering_id && (
          <div className="tally-line">
            <span className="tally-lbl">Offering</span>
            <Named src={offeringIcon(p.offering_id)} name={p.offering_name || p.offering_id} />
          </div>
        )}
        {p.post_game_stat && (
          <div className="tally-line">
            <span className="tally-lbl">Score</span>
            <span className="muted" style={{ fontSize: 12 }}>
              {Object.entries(p.post_game_stat).map(([k, v]) => `${CAT_LABEL(k)} ${num(v)}`).join(' · ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Factors({ list = [] }) {
  if (!list.length) return null;
  return (
    <div className="panel-block anim-rise" style={{ marginTop: 0, gridColumn: '1 / -1' }}>
      <div className="section-label">
        Likely factors <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· heuristic read from perks &amp; scores, not a verdict</span>
      </div>
      {list.map((x, i) => (
        <div key={i} className={`factor factor-${x.dir}${x.weight === 'major' ? ' major' : ''}`}>
          <span className="factor-mark">{x.dir === 'for' ? '＋' : x.dir === 'against' ? '－' : '·'}</span>
          {x.text}
        </div>
      ))}
    </div>
  );
}

/**
 * The sectioned tally layout — shared by the standalone /matches/:id page and the
 * inline expand inside a MatchCard. `showHeader` off when the card already shows
 * the self summary above it.
 */
export default function MatchDetailBody({ match: m, showHeader = true }) {
  if (!m) return <p className="muted">Loading…</p>;
  const self = m.players.find((p) => p.is_self) ?? {};
  const notes = m.correctionNotes ?? m.correction_notes ?? [];
  const load = self.perks ?? [];

  return (
    <>
      {showHeader && (
        <div className="panel-block anim-rise" style={{ marginTop: 0, display: 'flex', gap: 14, alignItems: 'center' }}>
          <GameIcon src={charIcon(self.character_id, self.role)} alt={self.character_name} size={56} rounded={6} />
          <div>
            <div style={{ fontWeight: 650, fontSize: 17, color: 'var(--text-bright)' }}>
              {self.character_name ?? '—'}
              {m.is_corrected && <> <span className="flag">Entity-corrected</span></>}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {when(m.played_at)} · {m.self_role} · {m.game_mode}
              {m.special_event_id ? ` · event ${m.special_event_id}` : ''} · {m.outcome}
              {m.self_kills != null ? ` · ${m.self_kills} kills` : ''}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="match-scorelabel">Score</div>
            <div className="match-score">
              {(self.leaderboard_score ?? self.bloodpoints)?.toLocaleString() ?? '—'}
              <span className="match-bp"> · {self.bloodpoints?.toLocaleString() ?? '—'} BP</span>
            </div>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="anim-rise" style={{ margin: '12px 0' }}>
          {notes.map((n, i) => (
            <div className="note" key={i}><strong>{n.rule}</strong> — {n.reason}</div>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <Card label="Your build">
          <div className="tally-loadout">
            <div className="tally-line">
              <span className="tally-lbl">Perks</span>
              {load.length ? load.map((x) => <Named key={x.id} src={perkIcon(x.id)} name={x.name || x.id} />)
                : <span className="muted">— not recorded</span>}
            </div>
            {(self.power_id || (self.addons ?? []).length) && (
              <div className="tally-line">
                <span className="tally-lbl">{self.role === 'killer' ? 'Power' : 'Item'}</span>
                {self.power_id && <Named src={itemIcon(self.power_id)} name={self.power_name || self.power_id} />}
                {(self.addons ?? []).map((x) => <Named key={x.id} src={addonIcon(x.id)} name={x.name || x.id} />)}
              </div>
            )}
            {self.offering_id && (
              <div className="tally-line">
                <span className="tally-lbl">Offering</span>
                <Named src={offeringIcon(self.offering_id)} name={self.offering_name || self.offering_id} />
              </div>
            )}
          </div>
        </Card>
        <Card label="Duration & result">
          <div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{dur(m.duration_seconds)}</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            {m.outcome}{m.self_kills != null ? ` · ${m.self_kills} kills` : ''}
          </div>
        </Card>
        <Card label="Emblems">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(self.emblems ?? []).map((e, i) => (
              <span key={i} className="named-item">
                <GameIcon src={emblemIcon(e.emblem_id, e.emblem_quality)} alt="" size={22} rounded={3} />
                <span>{e.emblem_name} <span className="muted">{e.emblem_quality}</span></span>
              </span>
            ))}
          </div>
        </Card>
        <Card label="Map" wide>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <GameIcon src={mapIcon(m.map_id)} alt={m.map_name} w={200} h={112} rounded={6} />
            <div style={{ color: 'var(--text-bright)', fontSize: 15 }}>{m.map_name ?? m.map_id ?? 'Unknown'}</div>
          </div>
        </Card>
      </div>

      <Factors list={m.factors} />

      <Card label="Everyone's loadout" wide>
        <div className="tally-list">
          {m.players.map((p) => <PlayerRow key={p.id} p={p} />)}
        </div>
      </Card>
    </>
  );
}

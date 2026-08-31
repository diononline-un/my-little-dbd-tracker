import { dur, when } from '../api.js';
import { QUALITY_COLORS } from '../api.js';
import ScoreBar from '../charts/ScoreBar.jsx';
import {
  GameIcon, PlayerPortrait, charIcon, mapIcon, perkIcon, addonIcon, offeringIcon, itemIcon, emblemIcon, statusIcon,
} from '../icons.jsx';

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
          {p.platform ? <span className="muted" style={{ textTransform: 'capitalize' }}> · {p.platform}</span> : null}
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
          <div className="tally-vals">
            {perks.length
              ? perks.map((x) => <Named key={x.id} src={perkIcon(x.id)} name={x.name || x.id} />)
              : <span className="muted">— not recorded</span>}
          </div>
        </div>
        {(p.power_id || addons.length > 0) && (
          <div className="tally-line">
            <span className="tally-lbl">{p.role === 'killer' ? 'Power' : 'Item'}</span>
            <div className="tally-vals">
              {p.power_id && <Named src={itemIcon(p.power_id)} name={p.power_name || p.power_id} />}
              {addons.map((x) => <Named key={x.id} src={addonIcon(x.id)} name={x.name || x.id} />)}
            </div>
          </div>
        )}
        {p.offering_id && (
          <div className="tally-line">
            <span className="tally-lbl">Offering</span>
            <div className="tally-vals">
              <Named src={offeringIcon(p.offering_id)} name={p.offering_name || p.offering_id} />
            </div>
          </div>
        )}
        {(p.emblems ?? []).length > 0 && (
          <div className="tally-line">
            <span className="tally-lbl">Emblems</span>
            <div className="tally-vals">
              {p.emblems.map((e, i) => (
                <span key={i} className="named-item" title={`${e.emblem_name}: ${e.emblem_quality}`}>
                  <GameIcon src={emblemIcon(e.emblem_id, e.emblem_quality)} alt="" size={18} rounded={2} />
                  <span style={{ color: QUALITY_COLORS[e.emblem_quality] ?? 'var(--text)' }}>{e.emblem_quality}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {p.post_game_stat && (
          <div className="tally-line">
            <span className="tally-lbl">Score</span>
            <div className="tally-vals"><ScoreBar post={p.post_game_stat} compact /></div>
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
        {self.post_game_stat && (
          <Card label="Your score" wide>
            <ScoreBar post={self.post_game_stat} />
            <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              {dur(m.duration_seconds)} · {m.outcome}
              {m.self_kills != null ? ` · ${m.self_kills} kills` : ''}
            </div>
          </Card>
        )}
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

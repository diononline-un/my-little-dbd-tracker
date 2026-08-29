import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api, dur, when, num } from '../api.js';
import {
  GameIcon, IconRow, charIcon, mapIcon, perkIcon, addonIcon, offeringIcon, itemIcon, emblemIcon, statusIcon,
} from '../icons.jsx';

const CAT_LABEL = (k) => k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');

function Card({ label, children, wide }) {
  return (
    <div className="panel-block anim-rise" style={{ marginTop: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <div className="section-label">{label}</div>
      {children}
    </div>
  );
}

function statusFromRow(p) {
  // reconstruct the VE_ id we can turn into an icon
  const map = {
    escaped: 'VE_Escaped', died: 'VE_Killed', sacrificed: 'VE_Sacrificed',
    dc: 'VE_Disconnected', ragequit: 'VE_Disconnected',
    surrender_loss: 'VE_SurrenderDraw', surrender_draw: 'VE_SurrenderDraw',
  };
  return map[p.status] ?? null;
}

function PlayerRow({ p }) {
  const [open, setOpen] = useState(false);
  const st = statusFromRow(p);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 4px',
          background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <GameIcon src={charIcon(p.character_id, p.role)} alt={p.character_name} size={34} rounded={5} />
        <span style={{ flex: 1, color: p.is_self ? 'var(--text-bright)' : 'var(--text)' }}>
          {p.character_name ?? p.character_id ?? '—'}
          {p.is_self ? ' · you' : ''}
          {p.prestige ? <span className="muted"> P{p.prestige}</span> : null}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.bloodpoints?.toLocaleString() ?? '—'}</span>
        {st && <GameIcon src={statusIcon(st)} alt={p.status} size={18} rounded={2} />}
        {p.killer_grade && <span className="muted" style={{ fontSize: 11 }}>{p.killer_grade.replace(' KILLER', '')}</span>}
        <span className="muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '4px 4px 12px 44px', display: 'grid', gap: 8 }}>
          <div>
            <span className="section-label">Perks</span>
            <IconRow items={(p.perks ?? []).map((x) => ({ key: x.id, src: perkIcon(x.id), alt: x.name, title: x.name }))} size={26} />
          </div>
          {(p.addons ?? []).length > 0 && (
            <div>
              <span className="section-label">Item &amp; add-ons</span>
              <IconRow
                items={[
                  ...(p.power_id ? [{ key: 'pw', src: itemIcon(p.power_id), alt: p.power_name, title: p.power_name }] : []),
                  ...(p.addons ?? []).map((x) => ({ key: x.id, src: addonIcon(x.id), alt: x.name, title: x.name })),
                ]}
                size={26} plusAfter={p.power_id ? 1 : undefined}
              />
            </div>
          )}
          {p.offering_id && (
            <div>
              <span className="section-label">Offering</span>
              <GameIcon src={offeringIcon(p.offering_id)} alt={p.offering_name} title={p.offering_name} size={26} rounded={4} />
            </div>
          )}
          {p.post_game_stat && (
            <div className="muted" style={{ fontSize: 12 }}>
              {Object.entries(p.post_game_stat).map(([k, v]) => `${CAT_LABEL(k)} ${num(v)}`).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchDetail() {
  const { matchId } = useParams();
  const { data: m, isLoading, error } = useQuery({ queryKey: ['match', matchId], queryFn: () => api.match(matchId) });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error) return <p className="warn">{String(error.message)}</p>;

  const self = m.players.find((p) => p.is_self) ?? {};
  const notes = m.correctionNotes ?? m.correction_notes ?? [];
  const load = self.perks ?? [];

  return (
    <>
      <p><Link to="/matches" className="muted">← all matches</Link></p>

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
          <div className="match-score">{self.bloodpoints?.toLocaleString() ?? '—'}</div>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="anim-rise" style={{ margin: '12px 0' }}>
          {notes.map((n, i) => (
            <div className="note" key={i}><strong>{n.rule}</strong> — {n.reason}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginTop: 12 }}>
        <Card label="Duration"><div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{dur(m.duration_seconds)}</div></Card>
        <Card label="Perks">
          <IconRow items={load.map((x) => ({ key: x.id, src: perkIcon(x.id), alt: x.name, title: x.name }))} size={30} />
        </Card>
        <Card label="Item & add-ons">
          <IconRow
            items={[
              ...(self.power_id ? [{ key: 'pw', src: itemIcon(self.power_id), alt: self.power_name, title: self.power_name }] : []),
              ...(self.addons ?? []).map((x) => ({ key: x.id, src: addonIcon(x.id), alt: x.name, title: x.name })),
            ]}
            size={30} plusAfter={self.power_id ? 1 : undefined}
          />
        </Card>
        <Card label="Offering">
          {self.offering_id
            ? <GameIcon src={offeringIcon(self.offering_id)} alt={self.offering_name} title={self.offering_name} size={30} rounded={5} />
            : <span className="muted">—</span>}
        </Card>
        <Card label="Emblems">
          <div style={{ display: 'flex', gap: 4 }}>
            {(self.emblems ?? []).map((e, i) => (
              <GameIcon key={i} src={emblemIcon(e.emblem_id, e.emblem_quality)} alt={`${e.emblem_name} ${e.emblem_quality}`}
                title={`${e.emblem_name}: ${e.emblem_quality}`} size={26} rounded={3} />
            ))}
          </div>
        </Card>
        <Card label="Map">
          <GameIcon src={mapIcon(m.map_id)} alt={m.map_name} w="100%" h={120} rounded={6} />
          <div style={{ marginTop: 6, color: 'var(--text-bright)' }}>{m.map_name ?? m.map_id ?? 'Unknown'}</div>
        </Card>
      </div>

      <Card label="Players" wide>
        <div style={{ marginTop: 4 }}>
          {m.players.map((p) => <PlayerRow key={p.id} p={p} />)}
        </div>
      </Card>
    </>
  );
}

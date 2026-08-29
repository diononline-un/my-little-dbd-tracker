import { useState } from 'react';

/**
 * Game art from BHVR's public asset CDN. Every `image.path` in a match payload is
 * exactly `<ASSET_BASE>/<path>`; the paths are also fully derivable from the ids
 * we store, so we rebuild them here and don't have to persist image columns.
 */
export const ASSET_BASE = 'https://assets.live.bhvraccount.com';

const url = (p) => (p ? `${ASSET_BASE}/${String(p).replace(/^\/+/, '')}` : null);

export const perkIcon = (id) => url(`perks/${id}.png`);
export const addonIcon = (id) => url(`add-ons/${id}.png`);
export const offeringIcon = (id) => url(`offerings/${id}.png`);
export const itemIcon = (id) => url(`items/${id}.png`);
export const mapIcon = (id) => url(`maps/${id}.png`);
export const statusIcon = (id) => url(`stats/${id}.png`);
export const charIcon = (id, role) =>
  url(`characters/${role === 'killer' ? 'killers' : 'survivors'}/${id}.png`);

/** normalized player status → the BHVR `stats/VE_*` art id */
export const STATUS_VE = {
  escaped: 'VE_Escaped',
  died: 'VE_Killed',
  sacrificed: 'VE_Sacrificed',
  dc: 'VE_Disconnected',
  ragequit: 'VE_Disconnected',
  surrender_loss: 'VE_SurrenderDraw',
  surrender_draw: 'VE_SurrenderDraw',
};
export const veIcon = (status) => (STATUS_VE[status] ? statusIcon(STATUS_VE[status]) : null);

const QUALITY_INDEX = { None: 0, Bronze: 1, Silver: 2, Gold: 3, Iridescent: 4 };
export const emblemIcon = (emblemId, quality) =>
  url(`emblems/${emblemId}_${QUALITY_INDEX[quality] ?? 0}.png`);

/**
 * <GameIcon src alt size> — square art tile. Fades in on load; on error it
 * collapses to a faint monogram box so a missing asset never leaves a broken
 * image glyph.
 */
export function GameIcon({ src, alt = '', size = 28, w, h, rounded = 6, title, className = '' }) {
  const [broken, setBroken] = useState(false);
  const box = {
    width: w ?? size,
    height: h ?? size,
    borderRadius: rounded,
    flex: '0 0 auto',
    border: '1px solid var(--border)',
    display: 'inline-block',
    objectFit: 'cover',
  };

  if (broken || !src) {
    return (
      <span
        className={`game-icon-fallback ${className}`}
        title={title ?? alt}
        style={{ ...box, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: (h ?? size) * 0.4, color: 'var(--text-dim)' }}
      >
        {(alt || '?').slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      title={title ?? alt}
      loading="lazy"
      className={`game-icon ${className}`}
      style={box}
      onError={() => setBroken(true)}
    />
  );
}

const DOWNED = new Set(['died', 'sacrificed', 'dc', 'ragequit']);

/**
 * Character portrait with the in-game result overlay: for a survivor who died,
 * disconnected or was sacrificed, the DBD `VE_*` status symbol (skull / entity
 * claw / disconnect) sits centred over a dimmed portrait. Escapes and the killer
 * are untouched.
 */
export function PlayerPortrait({ characterId, role, name, status, size = 40, rounded = 4 }) {
  const downed = role !== 'killer' && DOWNED.has(status);
  return (
    <span className="pp" style={{ width: size, height: size }}>
      <GameIcon
        src={charIcon(characterId, role)} alt={name} size={size} rounded={rounded}
        className={downed ? 'pp-dim' : ''}
      />
      {downed && (
        <img className="pp-status" src={veIcon(status)} alt={status}
          style={{ width: size * 0.62, height: size * 0.62 }} />
      )}
    </span>
  );
}

/** A horizontal strip of small icons (perks, add-ons, …) with an optional "+". */
export function IconRow({ items = [], size = 22, gap = 3, plusAfter }) {
  const out = [];
  items.forEach((it, i) => {
    if (plusAfter === i) {
      out.push(
        <span key={`plus-${i}`} style={{ color: 'var(--text-dim)', margin: '0 1px' }}>+</span>,
      );
    }
    out.push(
      <GameIcon key={it.key ?? i} src={it.src} alt={it.alt} title={it.title} size={size} rounded={4} />,
    );
  });
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>{out}</span>;
}

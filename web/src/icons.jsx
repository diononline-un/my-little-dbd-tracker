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

const DEAD = new Set(['died', 'sacrificed']);
const OUT = new Set(['dc', 'ragequit']);

/**
 * Character portrait with a result overlay: red ✕ + dimmed for a death,
 * "OUT" for a disconnect, untouched for an escape / the killer.
 */
export function PlayerPortrait({ characterId, role, name, status, size = 40, rounded = 4 }) {
  const dead = DEAD.has(status);
  const out = OUT.has(status);
  return (
    <span className="pp" style={{ width: size, height: size }}>
      <GameIcon
        src={charIcon(characterId, role)} alt={name} size={size} rounded={rounded}
        className={dead || out ? 'pp-dim' : ''}
      />
      {dead && <span className="pp-x" aria-label="died">✕</span>}
      {out && <span className="pp-out">OUT</span>}
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

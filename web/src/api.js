async function get(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}
const qs = (params = {}) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();

export const api = {
  summary: () => get('/summary'),
  matches: (params = {}) => get(`/matches?${qs(params)}`),
  match: (id) => get(`/matches/${id}`),

  career: (params = {}) => get(`/career?${qs(params)}`),
  careerTrend: (params = {}) => get(`/career/trend?${qs(params)}`),

  killers: (params = {}) => get(`/analytics/killers?${qs(params)}`),
  selfKillers: () => get('/analytics/self-killers'),
  maps: (params = {}) => get(`/analytics/maps?${qs(params)}`),
  builds: (params = {}) => get(`/analytics/builds?${qs(params)}`),
  perkPairs: (params = {}) => get(`/analytics/perk-pairs?${qs(params)}`),
  offerings: (params = {}) => get(`/analytics/offerings?${qs(params)}`),
  teammates: (params = {}) => get(`/analytics/teammates?${qs(params)}`),

  streaks: () => get('/insights/streaks'),
  form: (params = {}) => get(`/insights/form?${qs(params)}`),
  scoreProfile: () => get('/insights/score-profile'),
  activity: (params = {}) => get(`/insights/activity?${qs(params)}`),
  killerMeta: () => get('/insights/killer-meta'),
  opponentPerks: (params = {}) => get(`/insights/opponent-perks?${qs(params)}`),
  characterStreaks: () => get('/insights/character-streaks'),
  sessions: (params = {}) => get(`/insights/sessions?${qs(params)}`),
  recap: (params = {}) => get(`/insights/recap?${qs(params)}`),
  scatter: (params = {}) => get(`/insights/scatter?${qs(params)}`),
  history: (params = {}) => get(`/insights/history?${qs(params)}`),
};

export const pct = (r) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
export const pct0 = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`);
export const dur = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
export const when = (ms) => (ms ? new Date(ms).toLocaleString() : '—');
export const num = (n) => (n == null ? '—' : Number(n).toLocaleString());
export const hrs = (n) => (n == null ? '—' : `${Number(n).toFixed(1)} h`);

/** compact thousands: 580 → "580", 1550 → "1.6k", 12500 → "13k" */
export const kfmt = (n) => {
  if (n == null) return '—';
  const v = Number(n);
  if (Math.abs(v) < 1000) return String(Math.round(v));
  const k = v / 1000;
  return `${Math.abs(k) >= 10 ? Math.round(k) : k.toFixed(1)}k`;
};

const CAT_LABEL = (k) => k.replace(/^DBD_(Camper|Slasher)ScoreCat_/, '');
const CAT_ORDER = [
  // survivor
  'Objectives', 'Altruism', 'Boldness', 'Survival',
  // killer
  'Hunter', 'Deviousness', 'Brutality', 'Sacrifice',
];
/** post_game_stat object → [[key, value], …] in a fixed, stable order. */
export const orderedCats = (pgs) => {
  if (!pgs) return [];
  return Object.entries(pgs).sort(
    (a, b) => CAT_ORDER.indexOf(CAT_LABEL(a[0])) - CAT_ORDER.indexOf(CAT_LABEL(b[0])),
  );
};

export const QUALITY_COLORS = {
  None: 'var(--q-none)',
  Bronze: 'var(--q-bronze)',
  Silver: 'var(--q-silver)',
  Gold: 'var(--q-gold)',
  Iridescent: 'var(--q-iri)',
};
export const QUALITY_ORDER = ['None', 'Bronze', 'Silver', 'Gold', 'Iridescent'];

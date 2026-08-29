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
};

export const pct = (r) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
export const pct0 = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`);
export const dur = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
export const when = (ms) => (ms ? new Date(ms).toLocaleString() : '—');
export const num = (n) => (n == null ? '—' : Number(n).toLocaleString());
export const hrs = (n) => (n == null ? '—' : `${Number(n).toFixed(1)} h`);

export const QUALITY_COLORS = {
  None: 'var(--q-none)',
  Bronze: 'var(--q-bronze)',
  Silver: 'var(--q-silver)',
  Gold: 'var(--q-gold)',
  Iridescent: 'var(--q-iri)',
};
export const QUALITY_ORDER = ['None', 'Bronze', 'Silver', 'Gold', 'Iridescent'];

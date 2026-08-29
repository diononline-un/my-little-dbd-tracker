const base = '';

async function get(path) {
  const res = await fetch(`${base}/api${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  summary: () => get('/summary'),
  matches: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    );
    return get(`/matches?${qs}`);
  },
  match: (id) => get(`/matches/${id}`),
  killers: (params = {}) => get(`/analytics/killers?${new URLSearchParams(params)}`),
  builds: (params = {}) => get(`/analytics/builds?${new URLSearchParams(params)}`),
  teammates: (params = {}) => get(`/analytics/teammates?${new URLSearchParams(params)}`),
};

export const pct = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`);
export const dur = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
export const when = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

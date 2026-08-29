/** Shared constants + settings access for the extension. */

export const BHVR = {
  apiBase: 'https://account-backend.bhvr.com',
  matchHistoryPath: '/player-stats/match-history/games/dbd/providers/bhvr',
  careerPath: '/player-stats/games/dbd/providers/bhvr',
  tokenPath: '/sso/token',
  clientId: 'DBDStats',
  matchHistoryLimit: 50, // API hard cap
  lang: 'en',
  // BHVR's "Total" bucket is bugged (all-zero); poll per real mode and let the
  // backend aggregate. Verified list from match-categories; refreshed at runtime.
  careerCategories: ['Regular', 'Calamari', 'ChocolateBox', 'Firefly', 'Cake'],
};

export const DEFAULTS = {
  enabled: true,
  backendUrl: 'http://localhost:8787',
  ingestToken: 'dev-ingest-token',
  pollMinutes: 10, // keep >= 10: ToS / rate-limit caution (see README)
};

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...(stored.settings ?? {}) };
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

/** Token bundle mirrored from the stats site by the content script. */
export async function getAuth() {
  const { auth } = await chrome.storage.local.get('auth');
  return auth ?? null;
}

export async function setAuth(auth) {
  await chrome.storage.local.set({ auth });
}

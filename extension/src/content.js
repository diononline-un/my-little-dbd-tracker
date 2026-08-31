/**
 * Runs on stats.deadbydaylight.com. The SPA keeps its OAuth tokens in
 * localStorage under "auth-store" (see docs/api-contract.md). A background
 * service worker can't read another origin's localStorage, so we mirror the
 * token bundle into chrome.storage.local whenever it changes.
 *
 * The SPA rotates its refresh token when it refreshes (roughly hourly, and on
 * reload), invalidating the previous one — so we must mirror promptly. Content
 * scripts can use chrome.storage directly, so we write there instead of
 * round-tripping through the service worker.
 */
let lastAccessFp = null;

function readAuthStore() {
  try {
    const raw = localStorage.getItem('auth-store');
    if (!raw) return null;
    const s = JSON.parse(raw)?.state ?? {};
    if (!s.authToken?.token || !s.refreshToken?.token) return null;
    return { authToken: s.authToken, refreshToken: s.refreshToken, capturedAt: Date.now() };
  } catch {
    return null;
  }
}

async function mirror() {
  const auth = readAuthStore();
  if (!auth) return;
  const fp = auth.authToken.token.slice(0, 12) + auth.authToken.expirationDate;
  if (fp === lastAccessFp) return; // unchanged
  lastAccessFp = fp;
  try {
    await chrome.storage.local.set({ auth });
    // nudge the worker so it can poll right after a fresh sign-in
    chrome.runtime.sendMessage({ type: 'auth-mirrored' }).catch(() => {});
  } catch {
    /* extension context invalidated (reloaded) — next page load re-mirrors */
  }
}

mirror();
setInterval(mirror, 15_000);
window.addEventListener('focus', mirror);
window.addEventListener('visibilitychange', () => { if (!document.hidden) mirror(); });

/**
 * inject.js (MAIN world) posts here when the SPA fetches its own match history —
 * relay it to the worker as an off-schedule poll trigger. inject.js already
 * debounces; the worker's alarm floor is the real rate limit.
 */
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.source !== 'entitytrack') return;
  if (e.data.type === 'match-history-fetched') {
    chrome.runtime.sendMessage({ type: 'run-now' }).catch(() => {});
  }
});

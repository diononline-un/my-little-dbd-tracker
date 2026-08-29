/**
 * Runs on stats.deadbydaylight.com. The SPA keeps its OAuth tokens in
 * localStorage under "auth-store" (see docs/api-contract.md). A background
 * service worker can't read another origin's localStorage, so we mirror the
 * token bundle into chrome.storage.local whenever the user visits the site.
 *
 * This is the ONLY way the collector gets credentials. Between visits the
 * background worker refreshes the short-lived access token itself using the
 * ~30-day refresh token captured here.
 */
function readAuthStore() {
  try {
    const raw = localStorage.getItem('auth-store');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const s = parsed?.state ?? {};
    if (!s.authToken?.token || !s.refreshToken?.token) return null;
    return {
      authToken: s.authToken,
      refreshToken: s.refreshToken,
      capturedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function push() {
  const auth = readAuthStore();
  if (auth) {
    chrome.runtime.sendMessage({ type: 'auth-mirror', auth }).catch(() => {});
  }
}

push();
// Catch the SPA rotating its token while the tab is open.
setInterval(push, 60_000);
window.addEventListener('focus', push);

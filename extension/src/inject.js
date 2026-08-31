/**
 * Runs in the PAGE context (MAIN world) on stats.deadbydaylight.com.
 *
 * The SPA has no realtime channel and BHVR pushes nothing — so normally we only
 * learn about a new match on the next 10-minute alarm. Here we wrap fetch/XHR so
 * that when the site itself pulls its match history (page load, tab focus, the
 * user hitting refresh), we nudge the service worker to ingest immediately.
 *
 * This adds no requests of its own and never polls faster than the debounce; the
 * chrome.alarms floor stays the real rate limit. MAIN-world scripts can't touch
 * chrome.* — we hand off via window.postMessage, which content.js relays.
 */
(() => {
  const MATCH_HISTORY_RE = /\/player-stats\/match-history\/games\/dbd\b/;
  const DEBOUNCE_MS = 30_000;
  let last = 0;

  function nudge(url) {
    if (!MATCH_HISTORY_RE.test(String(url))) return;
    const now = Date.now();
    if (now - last < DEBOUNCE_MS) return;
    last = now;
    window.postMessage({ source: 'entitytrack', type: 'match-history-fetched' }, window.location.origin);
  }

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function patchedFetch(input, init) {
      try { nudge(typeof input === 'string' ? input : input?.url); } catch { /* ignore */ }
      return origFetch.apply(this, arguments);
    };
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
    try { nudge(url); } catch { /* ignore */ }
    return origOpen.apply(this, arguments);
  };
})();

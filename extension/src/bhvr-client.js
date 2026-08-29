/**
 * Thin client for the BHVR stats API. All auth is a bearer access token (~1h
 * lifetime); when it is near expiry we refresh it with the long-lived refresh
 * token, exactly as the SPA does:
 *   POST https://account-backend.bhvr.com/sso/token
 *   Content-Type: application/json
 *   { "grant_type": "refresh_token", "client_id": "DBDStats", "refresh_token": "..." }
 * The refresh token rotates on every refresh, so we persist the new bundle.
 * If the stored refresh token is stale (the SPA rotated it while its tab was
 * open) the call 400s — the fix is to revisit stats.deadbydaylight.com so the
 * content script re-mirrors.
 */
import { BHVR, getAuth, setAuth } from './config.js';

const EXPIRY_SKEW_MS = 90_000;

function isExpired(tok) {
  return !tok?.token || !tok.expirationDate || Date.now() > tok.expirationDate - EXPIRY_SKEW_MS;
}

async function refreshAccessToken(auth) {
  if (isExpired(auth.refreshToken)) {
    throw new Error('refresh token expired — open stats.deadbydaylight.com to re-auth');
  }
  const res = await fetch(BHVR.apiBase + BHVR.tokenPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: BHVR.clientId,
      refresh_token: auth.refreshToken.token,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `token refresh ${res.status} — stored token likely stale; open stats.deadbydaylight.com`,
    );
  }
  const next = normalizeTokenResponse(await res.json(), auth);
  await setAuth(next);
  return next;
}

/** Map whatever /sso/token returns onto our { authToken, refreshToken } bundle. */
function normalizeTokenResponse(data, prev) {
  const now = Date.now();
  const access =
    data.authToken ??
    (data.access_token
      ? { token: data.access_token, expirationDate: now + (data.expires_in ?? 1200) * 1000 }
      : null);
  const refresh =
    data.refreshToken ??
    (data.refresh_token
      ? { token: data.refresh_token, expirationDate: now + (data.refresh_expires_in ?? 2_592_000) * 1000 }
      : prev.refreshToken);
  if (!access?.token) throw new Error('unexpected token refresh response shape');
  return { authToken: access, refreshToken: refresh, capturedAt: now };
}

async function authHeader() {
  let auth = await getAuth();
  if (!auth) throw new Error('no credentials — open stats.deadbydaylight.com while signed in');
  if (isExpired(auth.authToken)) auth = await refreshAccessToken(auth);
  return `Bearer ${auth.authToken.token}`;
}

export async function fetchMatchHistory({ limit = BHVR.matchHistoryLimit } = {}) {
  const qs = new URLSearchParams({ lang: BHVR.lang, limit: String(limit) });
  const res = await fetch(`${BHVR.apiBase}${BHVR.matchHistoryPath}?${qs}`, {
    headers: { Authorization: await authHeader() },
  });
  if (res.status === 401) throw new Error('BHVR returned 401 — token rejected');
  if (!res.ok) throw new Error(`match-history ${res.status}`);
  return res.json();
}

/**
 * Thin client for the BHVR stats API. All auth is a bearer access token; when it
 * is within 60s of expiry we refresh it with the long-lived refresh token.
 *
 * ⚠️ The refresh request/response shape is NOT yet verified against a live token
 * rotation (see docs/api-contract.md "Open follow-ups"). We try form-encoded
 * first (OAuth2 standard) then JSON, and surface a clear error if both fail so
 * the user knows to revisit stats.deadbydaylight.com.
 */
import { BHVR, getAuth, setAuth } from './config.js';

const EXPIRY_SKEW_MS = 60_000;

function isExpired(tok) {
  return !tok?.token || !tok.expirationDate || Date.now() > tok.expirationDate - EXPIRY_SKEW_MS;
}

async function refreshAccessToken(auth) {
  if (isExpired(auth.refreshToken)) {
    throw new Error('refresh token expired — open stats.deadbydaylight.com to re-auth');
  }
  const url = BHVR.apiBase + BHVR.tokenPath;
  const params = {
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken.token,
    client_id: BHVR.clientId,
  };

  const attempts = [
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    },
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
  ];

  let lastErr;
  for (const a of attempts) {
    try {
      const res = await fetch(url, { method: 'POST', ...a });
      if (!res.ok) { lastErr = new Error(`token refresh ${res.status}`); continue; }
      const data = await res.json();
      const next = normalizeTokenResponse(data, auth);
      await setAuth(next);
      return next;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('token refresh failed');
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

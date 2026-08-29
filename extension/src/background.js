/**
 * Service worker: the collector loop.
 *
 * MV3 workers are evicted between runs, so all state lives in chrome.storage and
 * the schedule lives in chrome.alarms (never setInterval). Each tick:
 *   1. pull the latest match history from BHVR
 *   2. POST it to the EntityTrack backend /api/ingest
 *   3. ask the backend which matches need a loadout re-poll, re-fetch, re-POST
 */
import { getSettings } from './config.js';
import { fetchMatchHistory } from './bhvr-client.js';

const ALARM = 'entitytrack-poll';

async function scheduleAlarm() {
  const { pollMinutes } = await getSettings();
  const period = Math.max(10, Number(pollMinutes) || 10);
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.create(ALARM, { periodInMinutes: period, delayInMinutes: 0.1 });
}

async function setStatus(patch) {
  const { status = {} } = await chrome.storage.local.get('status');
  await chrome.storage.local.set({ status: { ...status, ...patch, at: Date.now() } });
}

async function postToBackend(path, payload) {
  const { backendUrl, ingestToken } = await getSettings();
  const res = await fetch(`${backendUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ingest-Token': ingestToken },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`backend ${path} -> ${res.status}`);
  return res.json();
}

async function getFromBackend(path) {
  const { backendUrl, ingestToken } = await getSettings();
  const res = await fetch(`${backendUrl.replace(/\/$/, '')}${path}`, {
    headers: { 'X-Ingest-Token': ingestToken },
  });
  if (!res.ok) throw new Error(`backend ${path} -> ${res.status}`);
  return res.json();
}

async function runOnce() {
  const { enabled } = await getSettings();
  if (!enabled) return;

  try {
    const history = await fetchMatchHistory();
    const result = await postToBackend('/api/ingest', {
      endpoint: '/player-stats/match-history/games/dbd/providers/bhvr',
      fetchedAt: Date.now(),
      httpStatus: 200,
      body: history,
    });

    // Re-poll queue: the backend deferred these for a missing loadout.
    let repolled = 0;
    try {
      const { matchIds = [] } = await getFromBackend('/api/repoll-queue');
      if (matchIds.length) {
        // The API has no per-match endpoint; a fresh full history covers recent ids.
        const fresh = await fetchMatchHistory();
        await postToBackend('/api/ingest', {
          endpoint: '/player-stats/match-history/games/dbd/providers/bhvr#repoll',
          fetchedAt: Date.now(),
          httpStatus: 200,
          body: fresh,
        });
        repolled = matchIds.length;
      }
    } catch (err) {
      console.warn('[EntityTrack] repoll step failed', err);
    }

    await setStatus({
      ok: true,
      lastRun: Date.now(),
      matches: result.matches?.length ?? 0,
      corrected: result.matches?.filter((m) => m.isCorrected).length ?? 0,
      repolled,
      error: null,
    });
  } catch (err) {
    console.error('[EntityTrack] poll failed', err);
    await setStatus({ ok: false, error: String(err.message ?? err) });
  }
}

chrome.runtime.onInstalled.addListener(scheduleAlarm);
chrome.runtime.onStartup.addListener(scheduleAlarm);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) runOnce();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'auth-mirrored') {
    // fresh token just landed (e.g. user signed in) — opportunistic poll
    runOnce().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'run-now') {
    runOnce().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'reschedule') {
    scheduleAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

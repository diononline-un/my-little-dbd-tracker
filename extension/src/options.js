import { getSettings, setSettings, DEFAULTS } from './config.js';

const $ = (id) => document.getElementById(id);
const fields = ['enabled', 'backendUrl', 'ingestToken', 'pollMinutes'];

async function load() {
  const s = await getSettings();
  $('enabled').checked = s.enabled;
  $('backendUrl').value = s.backendUrl;
  $('ingestToken').value = s.ingestToken;
  $('pollMinutes').value = s.pollMinutes;
  await renderStatus();
}

async function renderStatus() {
  const { status, auth } = await chrome.storage.local.get(['status', 'auth']);
  const lines = [];
  if (auth?.authToken?.expirationDate) {
    const mins = Math.round((auth.authToken.expirationDate - Date.now()) / 60000);
    lines.push(`credentials: captured, access token ${mins > 0 ? `valid ~${mins} min` : 'expired (will refresh)'}`);
  } else {
    lines.push('credentials: NONE — open stats.deadbydaylight.com while signed in');
  }
  if (status) {
    lines.push(
      status.ok
        ? `last run: ${new Date(status.lastRun).toLocaleString()} — ${status.matches} matches, ${status.corrected} corrected, ${status.repolled} re-polled, ${status.careerInserted ?? 0} career snapshots`
        : `last run FAILED: ${status.error}`,
    );
  } else {
    lines.push('last run: never');
  }
  const el = $('status');
  el.textContent = lines.join('\n');
  el.className = status && !status.ok ? 'err' : '';
}

async function save() {
  const patch = {
    enabled: $('enabled').checked,
    backendUrl: $('backendUrl').value.trim() || DEFAULTS.backendUrl,
    ingestToken: $('ingestToken').value.trim(),
    pollMinutes: Math.max(10, Number($('pollMinutes').value) || 10),
  };

  // Ask for host permission for a non-localhost backend origin.
  try {
    const origin = new URL(patch.backendUrl).origin + '/*';
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(patch.backendUrl)) {
      await chrome.permissions.request({ origins: [origin] });
    }
  } catch { /* invalid URL handled by input type=url */ }

  await setSettings(patch);
  await chrome.runtime.sendMessage({ type: 'reschedule' });
  const el = $('status');
  el.textContent = 'saved';
  el.className = 'saved';
  setTimeout(renderStatus, 800);
}

$('save').addEventListener('click', save);
$('runNow').addEventListener('click', async () => {
  $('status').textContent = 'running…';
  await chrome.runtime.sendMessage({ type: 'run-now' });
  setTimeout(renderStatus, 1200);
});
fields.forEach((f) => $(f).addEventListener('change', () => {}));

load();

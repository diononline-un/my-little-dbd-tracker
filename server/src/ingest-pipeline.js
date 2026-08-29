/**
 * Ingestion pipeline: raw payload -> stored raw -> normalized -> corrected -> DB.
 * Used by POST /api/ingest and by tests.
 */
import { config } from './config.js';
import { normalize } from './normalize/index.js';
import { runCorrector } from './corrector/index.js';
import {
  storeRawPayload,
  saveNormalizedMatch,
  bumpRepollAttempt,
  clearRepoll,
  getMatch,
} from './repository.js';

export function ingestPayload({ endpoint, body, httpStatus = 200, now = new Date() }) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;

  const raw = storeRawPayload({
    endpoint,
    fetchedAt: now,
    httpStatus,
    body: text,
  });

  const normalized = normalize(parsed);
  const results = [];

  for (const n of normalized) {
    if (n.match.isCustomMatch) {
      results.push({ matchId: n.match.matchId, skipped: 'custom-match' });
      continue;
    }

    const prior = getMatch(n.match.matchId);
    const attempts = prior?.repollAttempts ?? 0;

    runCorrector(n, {
      now,
      delayMinutes: config.repollDelayMinutes,
      maxAttempts: config.repollMaxAttempts,
      attempts,
    });

    saveNormalizedMatch(n, raw.id);

    if (n.match.repollAfter) {
      bumpRepollAttempt(n.match.matchId);
    } else if (prior?.repollAfter) {
      clearRepoll(n.match.matchId); // a re-poll filled the gap
    }

    results.push({
      matchId: n.match.matchId,
      isCorrected: n.match.isCorrected,
      corrections: n.match.correctionNotes.map((c) => c.rule),
      repollScheduled: Boolean(n.match.repollAfter),
    });
  }

  return {
    rawPayloadId: raw.id,
    deduped: raw.deduped,
    matches: results,
  };
}

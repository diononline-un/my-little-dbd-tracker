import { config } from '../config.js';
import { ingestPayload } from '../ingest-pipeline.js';
import { dueRepolls } from '../repository.js';

const MATCH_HISTORY_ENDPOINT =
  '/player-stats/match-history/games/dbd/providers/bhvr';

export default async function ingestRoutes(app) {
  // Auth: shared secret. Applies to this plugin's routes only.
  app.addHook('preHandler', async (req, reply) => {
    const token = req.headers['x-ingest-token'];
    if (!token || token !== config.ingestToken) {
      reply.code(401).send({ error: 'bad or missing X-Ingest-Token' });
    }
  });

  /**
   * The extension POSTs the raw match-history JSON here.
   * Body: { endpoint?: string, fetchedAt?: number, httpStatus?: number, body: <raw JSON> }
   * `body` may be the parsed array or a JSON string.
   */
  app.post('/ingest', async (req, reply) => {
    const { endpoint = MATCH_HISTORY_ENDPOINT, httpStatus = 200 } = req.body ?? {};
    const body = req.body?.body ?? req.body;
    if (body == null) return reply.code(400).send({ error: 'missing body' });

    try {
      const result = ingestPayload({ endpoint, body, httpStatus });
      return result;
    } catch (err) {
      req.log.error({ err }, 'ingest failed');
      return reply.code(422).send({ error: 'could not process payload', detail: err.message });
    }
  });

  /**
   * The extension polls this every alarm to learn which match ids need a
   * loadout re-poll (missing-loadout rule). Returns match ids only — the
   * extension re-fetches those from BHVR and re-POSTs to /ingest.
   */
  app.get('/repoll-queue', async () => {
    const rows = dueRepolls(config.repollMaxAttempts);
    return { matchIds: rows.map((r) => r.matchId), items: rows };
  });
}

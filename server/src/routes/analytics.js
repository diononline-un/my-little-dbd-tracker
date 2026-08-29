import {
  killerAnalytics,
  buildAnalytics,
  teammateAnalytics,
} from '../analytics.js';

export default async function analyticsRoutes(app) {
  app.get('/analytics/killers', async (req) => {
    const q = req.query ?? {};
    return { killers: killerAnalytics({ mapId: q.mapId, selfPerkId: q.perkId }) };
  });

  app.get('/analytics/builds', async (req) => {
    const min = Number(req.query?.minMatches) || 3;
    return { builds: buildAnalytics({ minMatches: min }) };
  });

  app.get('/analytics/teammates', async (req) => {
    const min = Number(req.query?.minMatches) || 3;
    return { teammates: teammateAnalytics({ minMatches: min }) };
  });
}

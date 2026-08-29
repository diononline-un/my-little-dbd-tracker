import {
  killerAnalytics,
  buildAnalytics,
  teammateAnalytics,
  mapAnalytics,
  selfKillerAnalytics,
  offeringAnalytics,
  perkPairAnalytics,
} from '../analytics.js';

const min = (req) => Number(req.query?.minMatches) || 3;

export default async function analyticsRoutes(app) {
  app.get('/analytics/killers', async (req) => ({
    killers: killerAnalytics({ mapId: req.query?.mapId, selfPerkId: req.query?.perkId }),
  }));

  app.get('/analytics/self-killers', async () => ({ killers: selfKillerAnalytics() }));

  app.get('/analytics/maps', async (req) => ({
    maps: mapAnalytics({ role: req.query?.role }),
  }));

  app.get('/analytics/builds', async (req) => ({ builds: buildAnalytics({ minMatches: min(req) }) }));

  app.get('/analytics/perk-pairs', async (req) => ({
    pairs: perkPairAnalytics({ minMatches: min(req) }),
  }));

  app.get('/analytics/offerings', async (req) => ({
    offerings: offeringAnalytics({ minMatches: min(req) }),
  }));

  app.get('/analytics/teammates', async (req) => ({
    teammates: teammateAnalytics({ minMatches: min(req) }),
  }));
}

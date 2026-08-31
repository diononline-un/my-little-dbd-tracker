import {
  killerAnalytics,
  buildAnalytics,
  teammateAnalytics,
  mapAnalytics,
  selfKillerAnalytics,
  offeringAnalytics,
  perkPairAnalytics,
  streaks,
  recentForm,
  killerMeta,
  opponentPerkMeta,
  activity,
  scoreProfile,
  characterStreaks,
  sessions,
  recap,
  scatter,
  history,
  estimatedGradeTrend,
} from '../analytics.js';

const SCATTER_DIMS = new Set(['vs-killers', 'my-killers', 'builds', 'maps', 'offerings']);

const min = (req) => Number(req.query?.minMatches) || 3;

export default async function analyticsRoutes(app) {
  app.get('/analytics/killers', async (req) => ({
    killers: killerAnalytics({ mapId: req.query?.mapId, selfPerkId: req.query?.perkId }),
  }));
  app.get('/analytics/self-killers', async () => ({ killers: selfKillerAnalytics() }));
  app.get('/analytics/maps', async (req) => ({ maps: mapAnalytics({ role: req.query?.role }) }));
  app.get('/analytics/builds', async (req) => ({ builds: buildAnalytics({ minMatches: min(req) }) }));
  app.get('/analytics/perk-pairs', async (req) => ({ pairs: perkPairAnalytics({ minMatches: min(req) }) }));
  app.get('/analytics/offerings', async (req) => ({ offerings: offeringAnalytics({ minMatches: min(req) }) }));
  app.get('/analytics/teammates', async (req) => ({ teammates: teammateAnalytics({ minMatches: min(req) }) }));

  // --- insights derived from accumulated match history ---
  app.get('/insights/streaks', async () => streaks());
  app.get('/insights/form', async (req) => recentForm({ limit: Number(req.query?.limit) || 20 }));
  app.get('/insights/score-profile', async () => scoreProfile());
  app.get('/insights/activity', async (req) => ({ days: activity({ days: Number(req.query?.days) || 120 }) }));
  app.get('/insights/killer-meta', async () => ({ killers: killerMeta() }));
  app.get('/insights/opponent-perks', async (req) => ({
    perks: opponentPerkMeta({ role: req.query?.role === 'killer' ? 'killer' : 'survivor', limit: Number(req.query?.limit) || 18 }),
  }));

  app.get('/insights/character-streaks', async () => characterStreaks());
  app.get('/insights/sessions', async (req) => ({
    sessions: sessions({ gapMinutes: Number(req.query?.gap) || 45 }),
  }));
  app.get('/insights/recap', async (req) => recap({ offset: Math.max(0, Number(req.query?.offset) || 0) }));
  app.get('/insights/history', async (req) => history({ rollingN: Number(req.query?.rollingN) || 15 }));
  app.get('/insights/grade-trend', async (req) => {
    const role = req.query?.role === 'survivor' || req.query?.role === 'killer' ? req.query.role : undefined;
    return estimatedGradeTrend({ role });
  });
  app.get('/insights/scatter', async (req) => {
    const dimension = SCATTER_DIMS.has(req.query?.dimension) ? req.query.dimension : 'my-killers';
    return { dimension, points: scatter({ dimension }) };
  });
}

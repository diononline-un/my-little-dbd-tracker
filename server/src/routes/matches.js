import { getMatch } from '../repository.js';
import { listMatches, summary } from '../analytics.js';
import { assetUrl } from '../reference/index.js';
import { analyzeMatch } from '../factors.js';

export default async function matchRoutes(app) {
  app.get('/summary', async () => summary());

  app.get('/matches', async (req) => {
    const q = req.query ?? {};
    return listMatches({
      role: q.role,
      killerId: q.killerId,
      mapId: q.mapId,
      corrected: q.corrected === undefined ? undefined : q.corrected === 'true',
      from: q.from,
      to: q.to,
      limit: q.limit,
      offset: q.offset,
    });
  });

  app.get('/matches/:matchId', async (req, reply) => {
    const match = getMatch(req.params.matchId);
    if (!match) return reply.code(404).send({ error: 'no such match' });

    // enrich player rows with absolute image urls; order by score (highest first)
    const hydrated = {
      ...match,
      is_corrected: Boolean(match.isCorrected ?? match.is_corrected),
      players: match.players
        .map((p) => ({
          ...p,
          perks: (p.perks ?? []).map((x) => ({ ...x, image: assetUrl(`perks/${x.id}.png`) })),
        }))
        .sort((a, b) => (b.leaderboard_score ?? b.bloodpoints ?? -1) - (a.leaderboard_score ?? a.bloodpoints ?? -1)),
    };
    return { ...hydrated, factors: analyzeMatch(hydrated) };
  });
}

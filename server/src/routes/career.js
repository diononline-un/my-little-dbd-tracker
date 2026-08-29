import { config } from '../config.js';
import { ingestCareer } from '../ingest-pipeline.js';
import { latestCareer, careerCategories, careerTrend } from '../repository.js';
import { careerWindows } from '../normalize/career.js';
import { categoryLabel, REAL_CATEGORIES } from '../reference/index.js';

export default async function careerRoutes(app) {
  // --- ingest (token-guarded, same secret as /api/ingest) ---
  app.post('/ingest/career', async (req, reply) => {
    if (req.headers['x-ingest-token'] !== config.ingestToken) {
      return reply.code(401).send({ error: 'bad or missing X-Ingest-Token' });
    }
    const { category } = req.body ?? {};
    const body = req.body?.body ?? null;
    if (!category || body == null) {
      return reply.code(400).send({ error: 'need { category, body }' });
    }
    try {
      return ingestCareer({ category, body });
    } catch (err) {
      req.log.error({ err }, 'career ingest failed');
      return reply.code(422).send({ error: err.message });
    }
  });

  // --- read ---
  app.get('/career', async (req) => {
    const category = req.query?.category ?? 'Regular';
    const snap = latestCareer(category);
    const known = careerCategories();
    return {
      category,
      categoryLabel: categoryLabel(category),
      availableCategories: (known.length ? known : REAL_CATEGORIES).map((c) => ({
        id: c,
        label: categoryLabel(c),
      })),
      capturedAt: snap?.captured_at ?? null,
      bhvrUpdatedAt: snap?.bhvr_updated_at ?? null,
      windows: snap ? careerWindows(snap.payload) : null,
    };
  });

  app.get('/career/trend', async (req, reply) => {
    const q = req.query ?? {};
    const category = q.category ?? 'Regular';
    const window = q.window === '30-days' ? '30-days' : 'all-time';
    const role = ['killers', 'survivors', 'general'].includes(q.role) ? q.role : 'survivors';
    const metrics = String(q.metrics ?? 'escapeRate')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (!metrics.length) return reply.code(400).send({ error: 'metrics required' });

    return {
      category,
      window,
      role,
      series: metrics.map((m) => ({
        metric: m,
        points: careerTrend(category, window, `${role}.${m}`),
      })),
    };
  });
}

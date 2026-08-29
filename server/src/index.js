import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import './db/index.js'; // opens the DB and applies the schema on boot
import ingestRoutes from './routes/ingest.js';
import matchRoutes from './routes/matches.js';
import analyticsRoutes from './routes/analytics.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

// The extension posts from a chrome-extension:// origin; the dashboard from the
// same origin as the API in production. Wide-open CORS is fine for a localhost
// self-host guarded by the ingest token.
await app.register(cors, { origin: true });

await app.register(async (api) => {
  await api.register(ingestRoutes);
  await api.register(matchRoutes);
  await api.register(analyticsRoutes);
  api.get('/health', async () => ({ ok: true }));
}, { prefix: '/api' });

// Serve the built dashboard if present (production container).
if (existsSync(config.webDist)) {
  await app.register(fastifyStatic, { root: config.webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html'); // SPA fallback
  });
}

app
  .listen({ port: config.port, host: config.host })
  .then((addr) => app.log.info(`EntityTrack API on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '0.0.0.0',
  // Shared secret the extension must present on POST /api/ingest.
  ingestToken: process.env.INGEST_TOKEN ?? 'dev-ingest-token',
  // SQLite file. In Docker this is a bind-mounted volume at /data.
  dbPath: process.env.DB_PATH ?? resolve(repoRoot, 'data/entitytrack.db'),
  // Static dashboard build served by Fastify (web/dist after `npm run build`).
  webDist: process.env.WEB_DIST ?? resolve(repoRoot, 'web/dist'),
  // Max times a match is re-polled for a missing loadout before we give up.
  repollMaxAttempts: Number(process.env.REPOLL_MAX_ATTEMPTS ?? 3),
  // How long the missing-loadout rule defers a match, in minutes.
  repollDelayMinutes: Number(process.env.REPOLL_DELAY_MINUTES ?? 15),
};

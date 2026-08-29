import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Give every test file its own throwaway SQLite DB before any app module loads.
process.env.DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'entitytrack-test-')),
  'test.db',
);
process.env.INGEST_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'silent';

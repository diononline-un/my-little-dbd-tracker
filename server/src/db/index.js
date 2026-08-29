import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { config } from '../config.js';
import { DDL } from './migrate.js';

// Loaded via require(+string concat) so bundlers/test runners don't try to
// pre-resolve it — Node 26's built-in SQLite isn't in every tool's builtin list.
const { DatabaseSync } = createRequire(import.meta.url)('node:' + 'sqlite');

/**
 * Single connection for the process, using Node's built-in SQLite (no native
 * build). Everything DB-specific is confined to this module + repository.js +
 * analytics.js — moving to Postgres means reimplementing those three against
 * `pg`, with the same table shapes (DDL below).
 */
mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(DDL); // idempotent CREATE TABLE IF NOT EXISTS

/** epoch ms <-> Date helpers; SQLite columns store integers. */
export const toMs = (d) => (d == null ? null : d instanceof Date ? d.getTime() : Number(d));
export const fromMs = (n) => (n == null ? null : new Date(Number(n)));
export const bool = (v) => (v == null ? null : v ? 1 : 0);

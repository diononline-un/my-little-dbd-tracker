import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks', // each test file gets its own process -> per-file DB_PATH works
    setupFiles: ['./test/setup.js'],
    server: {
      // Node 26's built-in SQLite isn't in Vite's builtin list yet; keep it native.
      deps: { external: [/node:sqlite/, 'node:sqlite'] },
    },
  },
  ssr: {
    external: ['node:sqlite'],
  },
});

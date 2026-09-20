import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Shared by both layers; the test path is passed on the command line (see package.json).
    // Each test file gets its own in-memory SQLite, never touching database.sqlite
    env: { DB_PATH: ':memory:' },
    fileParallelism: false,
    hookTimeout: 10000,
  },
});

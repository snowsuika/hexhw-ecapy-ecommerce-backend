import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Unit + existing API tests; integration tests use vitest.integration.config.js
    include: ['test/**/*.test.js', 'tests/*.test.js'],
    // Each test file gets its own in-memory SQLite, never touching database.sqlite
    env: { DB_PATH: ':memory:' },
    fileParallelism: false,
    hookTimeout: 10000,
  },
});

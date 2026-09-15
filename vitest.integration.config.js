import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/integration/**/*.test.js'],
    // Isolated in-memory SQLite: integration tests must never modify database.sqlite
    env: { DB_PATH: ':memory:' },
    fileParallelism: false,
    hookTimeout: 10000,
  },
});

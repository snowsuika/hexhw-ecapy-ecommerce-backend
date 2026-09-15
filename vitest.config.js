import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Unit + existing API tests; integration tests use vitest.integration.config.js
    include: ['test/**/*.test.js', 'tests/*.test.js'],
    // Each test file gets its own in-memory SQLite, never touching database.sqlite
    env: { DB_PATH: ':memory:' },
    fileParallelism: false,
    sequence: {
      files: [
        'test/shipping.test.js',
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js',
      ],
    },
    hookTimeout: 10000,
  },
});

import { defineConfig } from 'vitest/config';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://sanfefer:sanfefer@localhost:5432/sanfefer_test';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDatabaseUrl,
      JWT_SECRET: 'test-secret-de-al-menos-treinta-y-dos-caracteres',
    },
  },
});

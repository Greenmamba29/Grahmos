import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    include: ['src/**/*.e2e.test.ts', 'src/**/*.e2e.spec.ts'],
    exclude: ['src/**/*.unit.test.ts', 'src/**/*.integration.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ['./src/test/setup.e2e.ts'],
    globalSetup: ['./src/test/global.setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    retry: 2
  }
});
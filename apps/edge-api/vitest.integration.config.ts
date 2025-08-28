import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['src/**/*.integration.test.ts', 'src/**/*.integration.spec.ts'],
    exclude: ['src/**/*.unit.test.ts', 'src/**/*.e2e.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: ['./src/test/setup.integration.ts'],
    globalSetup: ['./src/test/global.setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
// E2E test setup
import { beforeAll, afterAll } from 'vitest';
beforeAll(async () => {
    // Setup E2E test environment
    process.env.NODE_ENV = 'test';
    process.env.API_PORT = '3001';
    process.env.MEILI_HOST = 'http://localhost:7700';
});
afterAll(async () => {
    // Cleanup after E2E tests
});
//# sourceMappingURL=setup.e2e.js.map
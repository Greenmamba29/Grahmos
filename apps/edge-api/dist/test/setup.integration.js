// Integration test setup
import { beforeAll, afterAll } from 'vitest';
beforeAll(async () => {
    // Setup integration test environment
    process.env.NODE_ENV = 'test';
    process.env.MEILI_HOST = 'http://localhost:7700';
    process.env.SQLITE_DB_PATH = ':memory:';
});
afterAll(async () => {
    // Cleanup after integration tests
});
//# sourceMappingURL=setup.integration.js.map
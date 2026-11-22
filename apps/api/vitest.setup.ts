/**
 * Test environment defaults. These are applied before any application module
 * is imported, so `src/config/env.ts` never depends on a developer's `.env`
 * file and tests cannot accidentally talk to a real database.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://taskapp:taskapp@localhost:5432/taskapp_test?schema=public";
process.env.JWT_ACCESS_SECRET =
  "integration-test-secret-that-is-long-enough-1234";
process.env.LOG_LEVEL = "silent";
process.env.CORS_ORIGINS = "http://localhost:3100";

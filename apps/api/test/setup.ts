/**
 * Test preload (registered in bunfig.toml).
 *
 * Several modules have import-time side effects that must never run in unit
 * tests: src/lib/db connects to Postgres and runs migrations, src/lib/redis
 * connects to Redis, src/lib/email creates an SMTP transport, and
 * src/config/env exits the process when required env vars are missing.
 *
 * This file sets safe env values BEFORE anything imports src/config/env and
 * replaces the side-effectful modules with inert stubs via mock.module().
 * Individual tests can override the stubs (e.g. mockDb.query.users.findFirst)
 * per test case.
 */
import { mock } from "bun:test";

process.env.NODE_ENV = "development";
process.env.PORT = "0";
process.env.POSTGRES_URL = "postgresql://test:test@localhost:5432/test";
process.env.API_URL = "https://api.test.localhost";
process.env.APP_URL = "https://app.test.localhost";
process.env.EMAIL_SMTP_URL = "smtp://localhost:1025";
process.env.EMAIL_FROM = "noreply@test.localhost";
process.env.SUPPORT_EMAIL = "support@test.localhost";
process.env.JWT_SECRET = "test-jwt-secret-only-for-unit-tests";
process.env.COOKIE_DOMAIN = ".test.localhost";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.DISCORD_CLIENT_ID = "test-discord-client-id";
process.env.DISCORD_CLIENT_SECRET = "test-discord-client-secret";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.TRUSTED_PROXY_ENABLED = "true";
process.env.UPLOADS_PATH = "./test/.uploads";
process.env.VERSION = "0.0.0-test";
process.env.POSTHOG_TOKEN = "";

/**
 * Minimal stand-in for the Drizzle db object. Tests that exercise db-backed
 * code paths should override the relevant methods, e.g.:
 *
 *   import { db } from "../lib/db";
 *   (db.query.users.findFirst as ReturnType<typeof mock>).mockResolvedValue(user);
 */
function createLazyMockObject() {
  // Returns the same lazily-created mock for repeated property access, so
  // tests can grab e.g. db.query.users.findFirst and configure/override it.
  const target: Record<string | symbol, unknown> = {};
  return new Proxy(target, {
    get(t, prop) {
      if (!(prop in t)) {
        t[prop] = mock(async () => undefined);
      }
      return t[prop];
    },
  });
}

function createDbStub() {
  const chain = () => {
    // Note: intentionally not thenable — `await builder` resolves to the
    // builder itself, which is sufficient for unit tests.
    const builder = {
      values: mock(() => builder),
      set: mock(() => builder),
      where: mock(() => builder),
      onConflictDoNothing: mock(() => builder),
      returning: mock(async () => []),
    };
    return builder;
  };

  // db.query.<table> returns a stable lazy mock object per table.
  const tables = new Map<string | symbol, ReturnType<typeof createLazyMockObject>>();
  const query = new Proxy(
    {},
    {
      get(_t, table) {
        if (!tables.has(table)) {
          tables.set(table, createLazyMockObject());
        }
        return tables.get(table);
      },
    },
  );

  return {
    query,
    insert: mock(chain),
    update: mock(chain),
    delete: mock(chain),
    select: mock(chain),
    transaction: mock(async (fn: (tx: unknown) => Promise<unknown>) => fn(createDbStub())),
  };
}

export const mockDb = createDbStub();

mock.module("../src/lib/db", () => ({
  db: mockDb,
  runMigrations: mock(async () => undefined),
}));

mock.module("../src/lib/redis", () => ({
  redis: {
    isOpen: true,
    scriptLoad: mock(async () => "test-sha"),
    evalSha: mock(async () => [1, 1000]),
    eval: mock(async () => [1, 1000]),
    quit: mock(async () => undefined),
  },
  connectRedis: mock(async () => undefined),
}));

mock.module("../src/lib/email", () => ({
  mailer: {},
  sendEmail: mock(async () => undefined),
}));

mock.module("../src/lib/posthog", () => ({
  posthog: null,
  captureException: mock(() => undefined),
}));

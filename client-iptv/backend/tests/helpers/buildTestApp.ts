import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { seedDatabase, type SeedFixture } from './seedDatabase.js'

/**
 * Test app factory (issue #25, BE-15).
 *
 * Creates a throwaway SQLite database in the OS temp dir, applies the real
 * migrations, loads the small JSON fixture and builds the real Fastify app so
 * tests can drive it via `app.inject()` — no network, no full dataset.
 *
 * The app's data layer reads the database path from the validated `config`
 * singleton, which is frozen at import time. So `DATABASE_PATH`/`NODE_ENV` must
 * be set *before* the connection/config modules are imported; this helper does
 * that and then dynamically imports them. Each call uses its own temp file, but
 * `getConnection()` is a process-wide singleton, so a test file must build at
 * most one app at a time and `teardown()` before building another.
 */

export interface TestApp {
  app: FastifyInstance
  /** The temp database file path (for ETL/connection assertions). */
  databasePath: string
  /** Close the app + connection and remove the temp directory. */
  teardown: () => Promise<void>
}

export interface BuildTestAppOptions {
  /** Override the fixture (defaults to tests/fixtures/seed.json). */
  fixture?: SeedFixture
  /** Skip loading the fixture (build an app against an empty schema). */
  seed?: boolean
}

export async function buildTestApp(options: BuildTestAppOptions = {}): Promise<TestApp> {
  const { fixture, seed = true } = options

  const tmpDir = mkdtempSync(join(tmpdir(), 'iptv-test-'))
  const databasePath = join(tmpDir, 'iptv.db')

  // Must be set before config/connection modules load.
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = databasePath

  // Import after env is set so the singletons resolve the temp path. Reset any
  // previously-cached connection so a prior test file's db is not reused.
  const conn = await import('../../src/db/connection.js')
  conn.closeConnection()

  const { runMigrations } = await import('../../src/db/migrate.js')
  const { resetFtsCache } = await import('../../src/db/fts.js')
  resetFtsCache()

  const db = conn.getConnection()
  runMigrations(db)
  if (seed) {
    seedDatabase(db, fixture)
  }

  const { buildApp } = await import('../../src/app.js')
  const app = await buildApp()
  await app.ready()

  const teardown = async (): Promise<void> => {
    await app.close()
    conn.closeConnection()
    resetFtsCache()
    rmSync(tmpDir, { recursive: true, force: true })
  }

  return { app, databasePath, teardown }
}

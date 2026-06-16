import { buildApp } from './app.js'
import { config } from './config/env.js'
import { closeDb, databaseFileExists, getDb } from './db/client.js'

/**
 * Server entrypoint (BE-01 / issue #11, BE-16 / issue #26).
 *
 * Builds the app, warns (without crashing) when the database has not been set
 * up yet, starts listening on the configured HOST/PORT and wires graceful
 * shutdown on SIGINT/SIGTERM.
 */

/**
 * Inspect the database at boot and log a clear warning if it is missing or
 * empty, pointing the operator to `npm run setup`. Never throws.
 */
async function warnIfDatabaseNotReady(log: { warn: (msg: string) => void }): Promise<void> {
  if (!databaseFileExists()) {
    log.warn('Database not found. Run `npm run setup` to migrate and load data.')
    return
  }

  try {
    const db = await getDb()
    if (!db) {
      log.warn('No SQLite driver available; data endpoints will be unavailable.')
      return
    }
    const row = db.prepare('SELECT COUNT(*) AS count FROM channels').get() as
      | { count: number }
      | undefined
    if (!row || row.count === 0) {
      log.warn('Database is empty. Run `npm run setup` to load IPTV data.')
    }
  } catch {
    log.warn('Database exists but is not initialized. Run `npm run setup`.')
  }
}

async function start(): Promise<void> {
  const app = await buildApp()

  await warnIfDatabaseNotReady(app.log)

  const closeGracefully = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down...`)
    try {
      await app.close()
      closeDb()
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', closeGracefully)
  process.on('SIGTERM', closeGracefully)

  try {
    await app.listen({ host: config.HOST, port: config.PORT })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()

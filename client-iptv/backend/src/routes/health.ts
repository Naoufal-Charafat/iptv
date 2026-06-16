import type { FastifyInstance } from 'fastify'
import { databaseFileExists, getDb } from '../db/client.js'
import { APP_VERSION } from '../lib/version.js'
import type { DbHealthResponse, HealthResponse } from '../types/contract.js'

/**
 * Health endpoints (BE-03 / issue #13).
 *
 * - `GET /api/health` is dependency-free and always 200 while the process runs.
 * - `GET /api/health/db` probes SQLite with `SELECT 1`; returns 503 (never
 *   crashes) when the database is missing or unavailable.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      version: APP_VERSION,
      timestamp: new Date().toISOString()
    }
  })

  app.get('/api/health/db', async (_request, reply) => {
    // No file on disk yet -> the app has not been set up.
    if (!databaseFileExists()) {
      reply.status(503)
      return {
        status: 'error',
        message: 'Database not initialized. Run `npm run setup`.'
      } satisfies DbHealthResponse
    }

    const db = await getDb()
    if (!db) {
      reply.status(503)
      return {
        status: 'error',
        message: 'No SQLite driver available.'
      } satisfies DbHealthResponse
    }

    try {
      // Liveness probe.
      db.prepare('SELECT 1').get()

      // Best-effort row count; the channels table may not exist before ETL.
      let channelsCount: number | undefined
      try {
        const row = db.prepare('SELECT COUNT(*) AS count FROM channels').get() as
          | { count: number }
          | undefined
        channelsCount = row?.count
      } catch {
        channelsCount = undefined
      }

      return { status: 'ok', channelsCount } satisfies DbHealthResponse
    } catch (error) {
      reply.status(503)
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Database query failed'
      } satisfies DbHealthResponse
    }
  })
}

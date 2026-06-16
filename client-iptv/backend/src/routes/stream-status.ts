import type { FastifyInstance } from 'fastify'
import { getConnection } from '../db/connection.js'
import { errors } from '../lib/errors.js'
import { checkStream, checkStreams } from '../lib/stream-check.js'
import {
  streamStatusBatchBodySchema,
  streamStatusQuerySchema
} from '../schemas/stream-status.schema.js'
import type { StreamStatus } from '../types/api.js'

/**
 * Stream availability routes (BE-14 / issue #24).
 *
 *   - `GET  /api/streams/status?url=...`   check one URL directly.
 *   - `GET  /api/streams/:id/status`       check a stream by its row id.
 *   - `POST /api/streams/status` { urls }  bounded-concurrency batch check.
 *
 * Results are cached in memory (TTL) and the SSRF guard validates every URL.
 * No upstream failure produces a 500 — failures map to a status string.
 */
export async function streamStatusRoutes(app: FastifyInstance): Promise<void> {
  // Direct URL check.
  app.get('/api/streams/status', async (request): Promise<StreamStatus> => {
    const { url } = streamStatusQuerySchema.parse(request.query)
    return checkStream(url)
  })

  // Batch check.
  app.post('/api/streams/status', async (request): Promise<StreamStatus[]> => {
    const { urls } = streamStatusBatchBodySchema.parse(request.body)
    return checkStreams(urls, { concurrency: 6 })
  })

  // Check by stream row id (resolves the URL + passthrough headers from the db).
  app.get('/api/streams/:id/status', async (request): Promise<StreamStatus> => {
    const idRaw = String((request.params as { id: string }).id)
    const id = Number.parseInt(idRaw, 10)
    if (!Number.isFinite(id) || id <= 0) {
      throw errors.badRequest(`Invalid stream id: ${idRaw}`)
    }

    const row = getConnection()
      .prepare(`SELECT url, user_agent, referrer FROM streams WHERE id = ?`)
      .get(id) as { url: string; user_agent: string | null; referrer: string | null } | undefined

    if (!row) {
      throw errors.notFound(`Stream not found: ${id}`)
    }

    return checkStream(row.url, {
      userAgent: row.user_agent ?? undefined,
      referrer: row.referrer ?? undefined
    })
  })
}

import type { FastifyInstance } from 'fastify'
import { ChannelsRepository } from '../db/repositories/channels.repo.js'
import { errors } from '../lib/errors.js'
import {
  channelIdParamsSchema,
  channelListQuerySchema
} from '../schemas/channels.query.js'
import {
  parseCursor,
  toChannelDetail,
  toChannelSummary,
  toCursorPage,
  toEpgGuide,
  toStream
} from './serializers.js'
import type { ChannelFilters, ChannelSort } from '../types/domain.js'
import type {
  ChannelDetail,
  ChannelSummary,
  EpgGuide,
  Paginated,
  Stream
} from '../types/api.js'

/**
 * Channel routes.
 *   - `GET /api/channels`            list with filters/pagination/sort (BE-08 / #18)
 *   - `GET /api/channels/:id`        full detail (BE-11 / #21)
 *   - `GET /api/channels/:id/streams` streams only (BE-11 / #21)
 *   - `GET /api/channels/:id/epg`    EPG guide reference (BE-11 / #21)
 *
 * Repositories are resolved lazily inside each handler so the routes can be
 * registered even when the DB file is not yet present (the data layer throws on
 * first query, surfaced as a clean 500/503 by the error handler).
 */
export async function channelsRoutes(app: FastifyInstance): Promise<void> {
  const repo = () => new ChannelsRepository()

  const SORT_MAP: Record<string, ChannelSort['field']> = {
    name: 'name',
    country: 'country',
    streams: 'streamCount'
  }

  app.get('/api/channels', async (request): Promise<Paginated<ChannelSummary>> => {
    const query = channelListQuerySchema.parse(request.query)

    const limit = query.limit
    // Cursor (offset string) wins; otherwise derive offset from page.
    const offset = query.cursor !== undefined ? parseCursor(query.cursor) : (query.page - 1) * limit

    const filters: ChannelFilters = {
      country: query.country,
      category: query.category,
      language: query.language,
      region: query.region,
      q: query.q,
      includeNsfw: query.is_nsfw
    }

    const sort: ChannelSort = {
      field: SORT_MAP[query.sort] ?? 'name',
      direction: query.order
    }

    // The repository paginates by 1-based page; translate the offset back.
    const page = Math.floor(offset / limit) + 1
    const result = repo().listChannels(filters, sort, { page, pageSize: limit })

    let items = result.items
    // `has_streams` defaults true: hide channels with no playable streams.
    if (query.has_streams) {
      items = items.filter(c => c.streamCount > 0)
    }

    const summaries = items.map(toChannelSummary)
    return toCursorPage(summaries, offset, limit, result.total)
  })

  app.get('/api/channels/:id/streams', async (request): Promise<Stream[]> => {
    const { id } = channelIdParamsSchema.parse(request.params)
    const r = repo()
    if (!r.getChannelById(id)) {
      throw errors.notFound(`Channel not found: ${id}`)
    }
    return r.getChannelStreams(id).map(toStream)
  })

  app.get('/api/channels/:id/epg', async (request): Promise<EpgGuide> => {
    const { id } = channelIdParamsSchema.parse(request.params)
    const r = repo()
    if (!r.getChannelById(id)) {
      throw errors.notFound(`Channel not found: ${id}`)
    }
    return toEpgGuide(id, r.getChannelGuide(id))
  })

  app.get('/api/channels/:id', async (request): Promise<ChannelDetail> => {
    const { id } = channelIdParamsSchema.parse(request.params)
    const r = repo()
    const channel = r.getChannelById(id)
    if (!channel) {
      throw errors.notFound(`Channel not found: ${id}`)
    }
    const feeds = r.getChannelFeeds(id)
    const logos = r.getChannelLogos(id)
    return toChannelDetail(channel, feeds, logos)
  })
}

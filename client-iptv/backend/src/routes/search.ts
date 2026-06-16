import type { FastifyInstance } from 'fastify'
import { SearchRepository } from '../db/repositories/search.repo.js'
import { ChannelsRepository } from '../db/repositories/channels.repo.js'
import { searchQuerySchema, suggestQuerySchema } from '../schemas/search.query.js'
import { parseCursor, toChannelSummary, toCursorPage } from './serializers.js'
import type { ChannelSummary, Paginated } from '../types/api.js'

/**
 * Full-text search routes (BE-10 / issue #20).
 *
 *   - `GET /api/search?q=...`         FTS5 channel search ranked by bm25.
 *   - `GET /api/search/suggest?q=...` lightweight autocomplete (top names).
 *
 * The query is sanitized inside the FTS helper (`toMatchQuery`) so special
 * characters never trigger an FTS5 syntax error. Results preserve relevance
 * order. Optional `category`/`country`/`language` filters are applied on the
 * resolved channel set.
 */
export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const searchRepo = () => new SearchRepository()
  const channelsRepo = () => new ChannelsRepository()

  app.get('/api/search', async (request): Promise<Paginated<ChannelSummary>> => {
    const query = searchQuerySchema.parse(request.query)

    const limit = query.limit
    const offset = query.cursor !== undefined ? parseCursor(query.cursor) : (query.page - 1) * limit
    const page = Math.floor(offset / limit) + 1

    const result = searchRepo().search(query.q, page, limit)

    let items = result.items
    if (query.category) {
      items = items.filter(c => c.categories.includes(query.category as string))
    }
    if (query.country) {
      items = items.filter(c => c.country === query.country)
    }
    if (query.language) {
      items = items.filter(c => c.languages.includes(query.language as string))
    }

    const summaries = items.map(toChannelSummary)
    // `total` from FTS is approximate; expose it as the contract's optional total.
    return toCursorPage(summaries, offset, limit, result.total)
  })

  app.get('/api/search/suggest', async (request): Promise<{ id: string; name: string }[]> => {
    const query = suggestQuerySchema.parse(request.query)
    const ids = searchRepo().searchIds(query.q, query.limit, 0)
    const repo = channelsRepo()
    const out: { id: string; name: string }[] = []
    for (const id of ids) {
      const channel = repo.getChannelById(id)
      if (channel) out.push({ id: channel.id, name: channel.name })
    }
    return out
  })
}

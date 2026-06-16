import type { FastifyInstance } from 'fastify'
import { ChannelsRepository } from '../db/repositories/channels.repo.js'
import { DimensionsRepository } from '../db/repositories/dimensions.repo.js'
import {
  dimensionItemsQuerySchema,
  dimensionParamsSchema
} from '../schemas/dimensions.query.js'
import { channelListQuerySchema } from '../schemas/channels.query.js'
import {
  parseCursor,
  toChannelSummary,
  toCursorPage,
  toDimensionItem
} from './serializers.js'
import { DIMENSIONS } from '../types/api.js'
import type {
  ChannelSummary,
  Dimension,
  DimensionItem,
  Paginated
} from '../types/api.js'
import type { ChannelFilters, DimensionName } from '../types/domain.js'

/**
 * Dimension catalogue routes (BE-09 / issue #19).
 *
 *   - `GET /api/dimensions`                 the 8 dimensions (grid metadata)
 *   - `GET /api/dimensions/:kind`           entries of one dimension (+counts)
 *   - `GET /api/dimensions/:kind/:id/channels`  channels under one entry
 *   - `GET /api/{categories,countries,...}` per-dimension aliases
 *
 * Every entry carries a `channelCount`; counts are computed in the repository
 * and scoped to non-blocked channels.
 */

/** Human labels + glyphs for the dimension grid ("Discover Contents"). */
const DIMENSION_META: Record<Dimension, { name: string; subtitle: string; glyph: string }> = {
  categories: { name: 'Categories', subtitle: 'Movies, News, Sports...', glyph: 'category' },
  cities: { name: 'Cities', subtitle: 'Local channels by city', glyph: 'location_city' },
  countries: { name: 'Countries', subtitle: 'Global broadcasts', glyph: 'public' },
  languages: { name: 'Languages', subtitle: 'Filter by audio', glyph: 'translate' },
  raw: { name: 'Raw', subtitle: 'Direct stream links', glyph: 'data_object' },
  regions: { name: 'Regions', subtitle: 'Continental groupings', glyph: 'map' },
  sources: { name: 'Sources', subtitle: 'Network providers', glyph: 'router' },
  subdivisions: { name: 'Subdivisions', subtitle: 'States & Provinces', glyph: 'grid_view' }
}

export async function dimensionsRoutes(app: FastifyInstance): Promise<void> {
  const dimRepo = () => new DimensionsRepository()
  const channelsRepo = () => new ChannelsRepository()

  /** Items of one dimension, with optional country/subdivision filtering. */
  function itemsFor(dimension: Dimension, country?: string, subdivision?: string): DimensionItem[] {
    let items = dimRepo()
      .listDimension(dimension as DimensionName)
      .map(toDimensionItem)

    // Optional filters apply to the geo dimensions whose entries expose a
    // country/subdivision in their subtitle/meta.
    if (country && (dimension === 'subdivisions' || dimension === 'cities')) {
      const raw = dimRepo().listDimension(dimension as DimensionName)
      const allowed = new Set(
        raw.filter(r => r.meta?.country === country).map(r => r.code)
      )
      items = items.filter(i => allowed.has(i.id))
    }
    if (subdivision && dimension === 'cities') {
      // cities reference a subdivision via their code prefix in the dataset; we
      // fall back to matching the subdivision code as a prefix of the city id.
      items = items.filter(i => i.id.startsWith(subdivision))
    }

    // Default ordering: by channel count desc, then name.
    return items.sort((a, b) => {
      const diff = (b.channelCount ?? 0) - (a.channelCount ?? 0)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    })
  }

  // Meta-endpoint: the 8 dimensions with element totals.
  app.get('/api/dimensions', async (): Promise<DimensionItem[]> => {
    const repo = dimRepo()
    return DIMENSIONS.map(dimension => {
      const count = repo.listDimension(dimension as DimensionName).length
      const meta = DIMENSION_META[dimension]
      return {
        id: dimension,
        name: meta.name,
        subtitle: meta.subtitle,
        glyph: meta.glyph,
        channelCount: count
      }
    })
  })

  // Entries of a single dimension.
  app.get('/api/dimensions/:dimension', async (request): Promise<DimensionItem[]> => {
    const { dimension } = dimensionParamsSchema.parse(request.params)
    const { country, subdivision } = dimensionItemsQuerySchema.parse(request.query)
    return itemsFor(dimension as Dimension, country, subdivision)
  })

  // Channels under one dimension entry (paginated like /channels).
  app.get(
    '/api/dimensions/:dimension/:id/channels',
    async (request): Promise<Paginated<ChannelSummary>> => {
      const { dimension } = dimensionParamsSchema.parse(request.params)
      const id = String((request.params as { id: string }).id)
      const query = channelListQuerySchema.parse(request.query)

      const limit = query.limit
      const offset =
        query.cursor !== undefined ? parseCursor(query.cursor) : (query.page - 1) * limit

      const filters: ChannelFilters = { includeNsfw: query.is_nsfw }
      switch (dimension as Dimension) {
        case 'categories':
          filters.category = id
          break
        case 'countries':
          filters.country = id
          break
        case 'languages':
          filters.language = id
          break
        case 'regions':
          filters.region = id
          break
        default:
          // subdivisions/cities/sources/raw have no per-channel join; return empty.
          return toCursorPage<ChannelSummary>([], offset, limit, 0)
      }

      const page = Math.floor(offset / limit) + 1
      const result = channelsRepo().listChannels(
        filters,
        { field: 'name', direction: 'asc' },
        { page, pageSize: limit }
      )
      const summaries = result.items.map(toChannelSummary)
      return toCursorPage(summaries, offset, limit, result.total)
    }
  )

  // ---- Per-dimension aliases (issue #19 explicit endpoints) ----
  const alias = (path: string, dimension: Dimension) => {
    app.get(path, async (request): Promise<DimensionItem[]> => {
      const { country, subdivision } = dimensionItemsQuerySchema.parse(request.query)
      return itemsFor(dimension, country, subdivision)
    })
  }
  alias('/api/categories', 'categories')
  alias('/api/countries', 'countries')
  alias('/api/languages', 'languages')
  alias('/api/regions', 'regions')
  alias('/api/subdivisions', 'subdivisions')
  alias('/api/cities', 'cities')
  alias('/api/sources', 'sources')
}

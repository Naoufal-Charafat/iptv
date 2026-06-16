import { getConnection, type Db, type SqlParam } from '../connection.js'
import {
  mapChannel,
  mapFeed,
  mapGuide,
  mapLogo,
  mapStream,
  type ChannelRow,
  type FeedRow,
  type GuideRow,
  type LogoRow,
  type StreamRow
} from '../mappers.js'
import type {
  ChannelDTO,
  ChannelFilters,
  ChannelSort,
  FeedDTO,
  GuideDTO,
  LogoDTO,
  Paginated,
  Pagination,
  StreamDTO
} from '../../types/domain.js'

/**
 * Channel repository (BE-07 / issue #17).
 *
 * All SQL for channels lives here. Every dynamic value is bound (no string
 * interpolation of user input), and sort fields/directions are mapped from a
 * closed allow-list, so the queries are not injectable.
 */

/**
 * Base SELECT for channel list/detail. Aggregates the in-use logo and the
 * stream count via correlated subqueries so each channel maps to one row.
 */
const CHANNEL_SELECT = `
  SELECT
    c.id, c.name, c.alt_names, c.network, c.owners, c.country, c.country_name,
    c.categories, c.is_nsfw, c.is_closed, c.launched, c.closed, c.replaced_by,
    c.website,
    (
      SELECT l.url FROM logos l
       WHERE l.channel = c.id
       ORDER BY l.in_use DESC, l.id ASC
       LIMIT 1
    ) AS logo_url,
    (
      SELECT COUNT(*) FROM streams s WHERE s.channel = c.id
    ) AS stream_count,
    (
      SELECT s.quality FROM streams s
       WHERE s.channel = c.id AND s.quality IS NOT NULL AND s.quality <> ''
       ORDER BY
         CASE s.quality
           WHEN '2160p' THEN 1 WHEN '1440p' THEN 2 WHEN '1080p' THEN 3
           WHEN '1080i' THEN 4 WHEN '720p' THEN 5 WHEN '576p' THEN 6
           WHEN '480p' THEN 7 WHEN '480i' THEN 8 WHEN '360p' THEN 9
           WHEN '240p' THEN 10 ELSE 99
         END ASC,
         s.id ASC
       LIMIT 1
    ) AS best_quality
  FROM channels c
`

const SORT_COLUMNS: Record<ChannelSort['field'], string> = {
  name: 'c.name',
  country: 'c.country',
  streamCount: 'stream_count'
}

interface WhereClause {
  sql: string
  params: SqlParam[]
}

function buildWhere(filters: ChannelFilters): WhereClause {
  const conditions: string[] = ['c.is_blocked = 0']
  const params: SqlParam[] = []

  if (!filters.includeClosed) {
    conditions.push('c.is_closed = 0')
  }
  if (!filters.includeNsfw) {
    conditions.push('c.is_nsfw = 0')
  }
  if (filters.country) {
    conditions.push('c.country = ?')
    params.push(filters.country.toUpperCase())
  }
  if (filters.category) {
    conditions.push(
      'EXISTS (SELECT 1 FROM channel_categories cc WHERE cc.channel_id = c.id AND cc.category_id = ?)'
    )
    params.push(filters.category)
  }
  if (filters.language) {
    conditions.push(
      'EXISTS (SELECT 1 FROM channel_languages cl WHERE cl.channel_id = c.id AND cl.language_code = ?)'
    )
    params.push(filters.language)
  }
  if (filters.region) {
    conditions.push(
      'EXISTS (SELECT 1 FROM region_countries rc WHERE rc.region_code = ? AND rc.country_code = c.country)'
    )
    params.push(filters.region)
  }
  if (filters.q && filters.q.trim().length > 0) {
    conditions.push('c.name LIKE ?')
    params.push(`%${filters.q.trim()}%`)
  }
  if (filters.hasStreams) {
    conditions.push('EXISTS (SELECT 1 FROM streams s WHERE s.channel = c.id)')
  }

  return { sql: `WHERE ${conditions.join(' AND ')}`, params }
}

export class ChannelsRepository {
  constructor(private readonly db: Db = getConnection()) {}

  /** List channels with filters, sort and pagination. */
  listChannels(
    filters: ChannelFilters = {},
    sort: ChannelSort = { field: 'name', direction: 'asc' },
    page: Pagination = { page: 1, pageSize: 30 }
  ): Paginated<ChannelDTO> {
    const where = buildWhere(filters)

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS total FROM channels c ${where.sql}`)
        .get(...where.params) as { total: number }
    ).total

    const sortColumn = SORT_COLUMNS[sort.field] ?? SORT_COLUMNS.name
    const direction = sort.direction === 'desc' ? 'DESC' : 'ASC'

    const pageSize = Math.max(1, Math.min(page.pageSize, 200))
    const pageNum = Math.max(1, page.page)
    const offset = (pageNum - 1) * pageSize

    const rows = this.db
      .prepare(
        `${CHANNEL_SELECT} ${where.sql}
         ORDER BY ${sortColumn} ${direction}, c.id ASC
         LIMIT ? OFFSET ?`
      )
      .all(...where.params, pageSize, offset) as ChannelRow[]

    return {
      items: rows.map(mapChannel),
      total,
      page: pageNum,
      pageSize
    }
  }

  /** Get a single channel by id (with its languages joined), or null. */
  getChannelById(id: string): ChannelDTO | null {
    const row = this.db
      .prepare(
        `${CHANNEL_SELECT}
         WHERE c.id = ?`
      )
      .get(id) as ChannelRow | undefined
    if (!row) return null

    const langs = this.db
      .prepare(`SELECT language_code FROM channel_languages WHERE channel_id = ?`)
      .all(id) as { language_code: string }[]
    row.languages = JSON.stringify(langs.map(l => l.language_code))

    return mapChannel(row)
  }

  /** All streams for a channel (by channel id or feed-relative match). */
  getChannelStreams(id: string): StreamDTO[] {
    const rows = this.db
      .prepare(
        `SELECT id, channel, feed, title, url, referrer, user_agent, quality, label
           FROM streams
          WHERE channel = ?
          ORDER BY id ASC`
      )
      .all(id) as StreamRow[]
    return rows.map(mapStream)
  }

  /** All logos for a channel, in-use first. */
  getChannelLogos(id: string): LogoDTO[] {
    const rows = this.db
      .prepare(
        `SELECT id, channel, feed, in_use, tags, width, height, format, url
           FROM logos
          WHERE channel = ?
          ORDER BY in_use DESC, id ASC`
      )
      .all(id) as LogoRow[]
    return rows.map(mapLogo)
  }

  /** All EPG guide entries for a channel. */
  getChannelGuide(id: string): GuideDTO[] {
    const rows = this.db
      .prepare(
        `SELECT id, channel, feed, site, site_id, site_name, lang, sources
           FROM guides
          WHERE channel = ?
          ORDER BY id ASC`
      )
      .all(id) as GuideRow[]
    return rows.map(mapGuide)
  }

  /** All feeds for a channel, main feed first. */
  getChannelFeeds(id: string): FeedDTO[] {
    const rows = this.db
      .prepare(
        `SELECT channel, id, name, alt_names, is_main, broadcast_area, languages, timezones, format
           FROM feeds
          WHERE channel = ?
          ORDER BY is_main DESC, id ASC`
      )
      .all(id) as FeedRow[]
    return rows.map(mapFeed)
  }
}

/** Convenience singleton bound to the default connection. */
export const channelsRepository = (db?: Db): ChannelsRepository =>
  new ChannelsRepository(db ?? getConnection())

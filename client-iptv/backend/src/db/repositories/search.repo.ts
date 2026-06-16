import { getConnection, type Db } from '../connection.js'
import { searchChannelIds } from '../fts.js'
import { mapChannel, type ChannelRow } from '../mappers.js'
import type { ChannelDTO, Paginated } from '../../types/domain.js'

/**
 * Search repository (BE-07 / issue #17).
 *
 * Wraps the FTS5 helper (`searchChannelIds`, issue #16) and resolves the
 * relevance-ordered ids into full channel DTOs, preserving the bm25 ranking.
 * Blocked channels are excluded from the resolved results.
 */

const RESOLVE_SELECT = `
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
  WHERE c.id = ? AND c.is_blocked = 0
`

export class SearchRepository {
  constructor(private readonly db: Db = getConnection()) {}

  /**
   * Full-text search channels by relevance. Returns a paginated envelope; the
   * `total` is a best-effort count of FTS hits for the query (capped) since
   * FTS5 does not return an exact total cheaply alongside ranked rows.
   */
  search(query: string, page = 1, pageSize = 30): Paginated<ChannelDTO> {
    const safePageSize = Math.max(1, Math.min(pageSize, 100))
    const pageNum = Math.max(1, page)
    const offset = (pageNum - 1) * safePageSize

    const hits = searchChannelIds(this.db, query, safePageSize, offset)

    const resolve = this.db.prepare(RESOLVE_SELECT)
    const items: ChannelDTO[] = []
    for (const hit of hits) {
      const row = resolve.get(hit.channel_id) as ChannelRow | undefined
      if (row) items.push(mapChannel(row))
    }

    return {
      items,
      // Approximate total: when a full page came back there may be more.
      total: offset + items.length + (hits.length === safePageSize ? safePageSize : 0),
      page: pageNum,
      pageSize: safePageSize
    }
  }

  /** Lightweight variant returning just the ranked channel ids. */
  searchIds(query: string, limit = 50, offset = 0): string[] {
    return searchChannelIds(this.db, query, limit, offset).map(h => h.channel_id)
  }
}

/** Convenience factory bound to the default connection. */
export const searchRepository = (db?: Db): SearchRepository =>
  new SearchRepository(db ?? getConnection())

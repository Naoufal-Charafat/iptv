import { getConnection, type Db } from '../connection.js'
import { mapChannel, type ChannelRow } from '../mappers.js'
import type { ChannelDTO } from '../../types/domain.js'

/**
 * Favorites repository (BE-07 / issue #17).
 *
 * Manages the local `favorites` table (this is a personal client). Favorites
 * survive ETL reloads because the ETL never clears this table. Resolving a
 * favorite to a channel DTO joins against the (re-loadable) channels table.
 */

const FAVORITE_CHANNEL_SELECT = `
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
  FROM favorites f
  JOIN channels c ON c.id = f.channel_id
  ORDER BY f.created_at DESC, c.name ASC
`

export class FavoritesRepository {
  constructor(private readonly db: Db = getConnection()) {}

  /** List favorited channels (most recently added first). */
  listFavorites(): ChannelDTO[] {
    const rows = this.db.prepare(FAVORITE_CHANNEL_SELECT).all() as ChannelRow[]
    return rows.map(mapChannel)
  }

  /** List favorited channel ids (most recently added first). */
  listFavoriteIds(): string[] {
    const rows = this.db
      .prepare(`SELECT channel_id FROM favorites ORDER BY created_at DESC, channel_id ASC`)
      .all() as { channel_id: string }[]
    return rows.map(r => r.channel_id)
  }

  /** Whether a channel id is favorited. */
  isFavorite(channelId: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 AS one FROM favorites WHERE channel_id = ?`)
      .get(channelId)
    return row !== undefined
  }

  /** Add a favorite (idempotent). Returns true if a new row was created. */
  addFavorite(channelId: string): boolean {
    const info = this.db
      .prepare(`INSERT OR IGNORE INTO favorites (channel_id) VALUES (?)`)
      .run(channelId)
    return info.changes > 0
  }

  /** Remove a favorite. Returns true if a row was deleted. */
  removeFavorite(channelId: string): boolean {
    const info = this.db.prepare(`DELETE FROM favorites WHERE channel_id = ?`).run(channelId)
    return info.changes > 0
  }
}

/** Convenience factory bound to the default connection. */
export const favoritesRepository = (db?: Db): FavoritesRepository =>
  new FavoritesRepository(db ?? getConnection())

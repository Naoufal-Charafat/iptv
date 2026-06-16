import { getConnection, type Db } from '../connection.js'
import { mapDimensionItem, type DimensionRow } from '../mappers.js'
import type { DimensionItemDTO, DimensionName } from '../../types/domain.js'

/**
 * Dimensions repository (BE-07 / issue #17).
 *
 * Returns the catalogue for each of the eight navigable dimensions, every entry
 * annotated with its count of non-blocked channels. All counts are scoped to
 * `channels.is_blocked = 0` so blocked content is never surfaced.
 */

/** The eight navigable dimensions. */
export const DIMENSIONS: readonly DimensionName[] = [
  'categories',
  'cities',
  'countries',
  'languages',
  'raw',
  'regions',
  'sources',
  'subdivisions'
] as const

export class DimensionsRepository {
  constructor(private readonly db: Db = getConnection()) {}

  /** Dispatch to the per-dimension query. */
  listDimension(name: DimensionName): DimensionItemDTO[] {
    switch (name) {
      case 'categories':
        return this.listCategories()
      case 'countries':
        return this.listCountries()
      case 'languages':
        return this.listLanguages()
      case 'regions':
        return this.listRegions()
      case 'subdivisions':
        return this.listSubdivisions()
      case 'cities':
        return this.listCities()
      case 'sources':
        return this.listSources()
      case 'raw':
        return this.listRaw()
      default: {
        // Exhaustiveness guard.
        const _never: never = name
        throw new Error(`Unknown dimension: ${String(_never)}`)
      }
    }
  }

  private listCategories(): DimensionItemDTO[] {
    const rows = this.db
      .prepare(
        `SELECT cat.id AS code, cat.name AS name,
                COUNT(DISTINCT ch.id) AS channel_count
           FROM categories cat
           LEFT JOIN channel_categories cc ON cc.category_id = cat.id
           LEFT JOIN channels ch ON ch.id = cc.channel_id AND ch.is_blocked = 0
          GROUP BY cat.id, cat.name
          ORDER BY cat.name ASC`
      )
      .all() as DimensionRow[]
    return rows.map(mapDimensionItem)
  }

  private listCountries(): DimensionItemDTO[] {
    const rows = this.db
      .prepare(
        `SELECT co.code AS code, co.name AS name, co.flag AS flag,
                COUNT(ch.id) AS channel_count
           FROM countries co
           LEFT JOIN channels ch ON ch.country = co.code AND ch.is_blocked = 0
          GROUP BY co.code, co.name, co.flag
          ORDER BY co.name ASC`
      )
      .all() as DimensionRow[]
    return rows.map(mapDimensionItem)
  }

  private listLanguages(): DimensionItemDTO[] {
    const rows = this.db
      .prepare(
        `SELECT la.code AS code, la.name AS name,
                COUNT(DISTINCT ch.id) AS channel_count
           FROM languages la
           JOIN channel_languages cl ON cl.language_code = la.code
           JOIN channels ch ON ch.id = cl.channel_id AND ch.is_blocked = 0
          GROUP BY la.code, la.name
          ORDER BY channel_count DESC, la.name ASC`
      )
      .all() as DimensionRow[]
    return rows.map(mapDimensionItem)
  }

  private listRegions(): DimensionItemDTO[] {
    const rows = this.db
      .prepare(
        `SELECT re.code AS code, re.name AS name,
                COUNT(DISTINCT ch.id) AS channel_count
           FROM regions re
           LEFT JOIN region_countries rc ON rc.region_code = re.code
           LEFT JOIN channels ch ON ch.country = rc.country_code AND ch.is_blocked = 0
          GROUP BY re.code, re.name
          ORDER BY re.name ASC`
      )
      .all() as DimensionRow[]
    return rows.map(mapDimensionItem)
  }

  private listSubdivisions(): DimensionItemDTO[] {
    // Channels are not tagged per-subdivision in the dataset; counts are derived
    // from the country the subdivision belongs to.
    const rows = this.db
      .prepare(
        `SELECT su.code AS code, su.name AS name, su.country AS country,
                COUNT(ch.id) AS channel_count
           FROM subdivisions su
           LEFT JOIN channels ch ON ch.country = su.country AND ch.is_blocked = 0
          GROUP BY su.code, su.name, su.country
          ORDER BY su.name ASC`
      )
      .all() as DimensionRow[]
    return rows.map(mapDimensionItem)
  }

  private listCities(): DimensionItemDTO[] {
    const rows = this.db
      .prepare(
        `SELECT ci.code AS code, ci.name AS name, ci.country AS country,
                COUNT(ch.id) AS channel_count
           FROM cities ci
           LEFT JOIN channels ch ON ch.country = ci.country AND ch.is_blocked = 0
          GROUP BY ci.code, ci.name, ci.country
          ORDER BY ci.name ASC`
      )
      .all() as DimensionRow[]
    return rows.map(mapDimensionItem)
  }

  private listSources(): DimensionItemDTO[] {
    // EPG guide sites, with how many distinct channels each provides a guide for.
    const rows = this.db
      .prepare(
        `SELECT g.site AS code,
                COALESCE(MAX(g.site_name), g.site) AS name,
                COUNT(DISTINCT ch.id) AS channel_count
           FROM guides g
           JOIN channels ch ON ch.id = g.channel AND ch.is_blocked = 0
          WHERE g.site IS NOT NULL AND g.site <> ''
          GROUP BY g.site
          ORDER BY channel_count DESC, g.site ASC`
      )
      .all() as DimensionRow[]
    return rows.map(mapDimensionItem)
  }

  private listRaw(): DimensionItemDTO[] {
    // The "raw" dimension is the full channel space; expose a single rollup
    // entry with the total non-blocked channel count.
    const row = this.db
      .prepare(`SELECT COUNT(*) AS channel_count FROM channels WHERE is_blocked = 0`)
      .get() as { channel_count: number }
    return [
      {
        code: 'raw',
        name: 'All channels',
        channelCount: Number(row.channel_count ?? 0)
      }
    ]
  }
}

/** Convenience factory bound to the default connection. */
export const dimensionsRepository = (db?: Db): DimensionsRepository =>
  new DimensionsRepository(db ?? getConnection())

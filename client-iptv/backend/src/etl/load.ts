import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DataManager, type Models } from '@iptv-org/sdk'
import { config } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { closeConnection, getConnection, type Db, type Statement } from '../db/connection.js'
import { runMigrations } from '../db/migrate.js'
import { rebuildFtsIndex, type ChannelFtsRow } from '../db/fts.js'

/**
 * ETL load stage (BE-05 / issue #15 + FTS rebuild BE-06 / issue #16).
 *
 * Loads the iptv-org datasets with `@iptv-org/sdk` (which resolves all
 * relations into model Collections), maps each model to SQL rows and writes
 * them with `INSERT OR REPLACE` inside a single transaction. Bridge tables and
 * the FTS index are rebuilt from scratch in the same transaction so a re-run is
 * fully idempotent (stable row counts, no duplicates).
 *
 * The loader works from any `dataDir` containing the 13 JSON files, so the same
 * code path powers both the networked ETL (`DATA_DIR`) and the offline seed
 * (`temp/data`).
 */

const TABLES = [
  'categories',
  'languages',
  'countries',
  'regions',
  'subdivisions',
  'cities',
  'channels',
  'feeds',
  'streams',
  'logos',
  'guides',
  'channel_categories',
  'channel_languages',
  'region_countries',
  'channels_fts'
] as const

type TableName = (typeof TABLES)[number]
export type LoadCounts = Record<TableName, number>

function jsonArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : [])
}

/** Load and process the datasets from disk using the SDK (no network). */
async function loadProcessedData(dataDir: string): Promise<ReturnType<DataManager['getProcessedData']>> {
  const manager = new DataManager({ dataDir })
  await manager.loadFromDisk()
  manager.processData()
  return manager.getProcessedData()
}

/** Delete all rows from the data tables so the reload is clean (idempotent). */
function clearTables(db: Db): void {
  // Order does not matter (no FK enforcement on these), but clear bridges too.
  const tablesToClear: string[] = [
    'channel_categories',
    'channel_languages',
    'region_countries',
    'streams',
    'logos',
    'guides',
    'feeds',
    'channels',
    'cities',
    'subdivisions',
    'regions',
    'countries',
    'languages',
    'categories'
  ]
  for (const t of tablesToClear) {
    db.exec(`DELETE FROM ${t}`)
  }
  // Reset AUTOINCREMENT counters so ids are stable across reloads.
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('streams','logos','guides')`)
}

interface Prepared {
  category: Statement
  language: Statement
  country: Statement
  region: Statement
  subdivision: Statement
  city: Statement
  channel: Statement
  feed: Statement
  stream: Statement
  logo: Statement
  guide: Statement
  channelCategory: Statement
  channelLanguage: Statement
  regionCountry: Statement
}

function prepareStatements(db: Db): Prepared {
  return {
    category: db.prepare(
      `INSERT OR REPLACE INTO categories (id, name, description) VALUES (?, ?, ?)`
    ),
    language: db.prepare(`INSERT OR REPLACE INTO languages (code, name) VALUES (?, ?)`),
    country: db.prepare(
      `INSERT OR REPLACE INTO countries (code, name, flag, languages) VALUES (?, ?, ?, ?)`
    ),
    region: db.prepare(
      `INSERT OR REPLACE INTO regions (code, name, countries) VALUES (?, ?, ?)`
    ),
    subdivision: db.prepare(
      `INSERT OR REPLACE INTO subdivisions (code, name, country, parent) VALUES (?, ?, ?, ?)`
    ),
    city: db.prepare(
      `INSERT OR REPLACE INTO cities (code, name, country, subdivision, wikidata_id)
       VALUES (?, ?, ?, ?, ?)`
    ),
    channel: db.prepare(
      `INSERT OR REPLACE INTO channels
         (id, name, alt_names, network, owners, country, categories, is_nsfw,
          launched, closed, replaced_by, website, is_closed, is_blocked, country_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    feed: db.prepare(
      `INSERT OR REPLACE INTO feeds
         (channel, id, stream_id, name, alt_names, is_main, broadcast_area,
          languages, timezones, format)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    stream: db.prepare(
      `INSERT INTO streams (channel, feed, title, url, referrer, user_agent, quality, label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    logo: db.prepare(
      `INSERT INTO logos (channel, feed, in_use, tags, width, height, format, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    guide: db.prepare(
      `INSERT INTO guides (channel, feed, site, site_id, site_name, lang, sources)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ),
    channelCategory: db.prepare(
      `INSERT OR IGNORE INTO channel_categories (channel_id, category_id) VALUES (?, ?)`
    ),
    channelLanguage: db.prepare(
      `INSERT OR IGNORE INTO channel_languages (channel_id, language_code) VALUES (?, ?)`
    ),
    regionCountry: db.prepare(
      `INSERT OR IGNORE INTO region_countries (region_code, country_code) VALUES (?, ?)`
    )
  }
}

/**
 * Map the processed Collections into SQL rows and write them. Runs entirely
 * inside `db.transaction(...)` provided by the caller.
 */
function writeAll(
  db: Db,
  data: ReturnType<DataManager['getProcessedData']>
): LoadCounts {
  const stmt = prepareStatements(db)
  const counts = Object.fromEntries(TABLES.map(t => [t, 0])) as LoadCounts

  // --- reference dimensions ---
  data.categories.forEach((c: Models.Category) => {
    stmt.category.run(c.id, c.name, c.description ?? null)
    counts.categories++
  })

  data.languages.forEach((l: Models.Language) => {
    stmt.language.run(l.code, l.name)
    counts.languages++
  })

  data.countries.forEach((c: Models.Country) => {
    stmt.country.run(c.code, c.name, c.flag ?? null, jsonArray(c.languages))
    counts.countries++
  })

  data.regions.forEach((r: Models.Region) => {
    stmt.region.run(r.code, r.name, jsonArray(r.countries))
    counts.regions++
    for (const cc of r.countries ?? []) {
      stmt.regionCountry.run(r.code, cc)
      counts.region_countries++
    }
  })

  data.subdivisions.forEach((s: Models.Subdivision) => {
    stmt.subdivision.run(s.code, s.name, s.country ?? null, s.parent ?? null)
    counts.subdivisions++
  })

  data.cities.forEach((c: Models.City) => {
    stmt.city.run(c.code, c.name, c.country ?? null, c.subdivision ?? null, c.wikidata_id ?? null)
    counts.cities++
  })

  // --- channels (+ bridge tables + FTS rows) ---
  const ftsRows: ChannelFtsRow[] = []

  data.channels.forEach((ch: Models.Channel) => {
    const searchable = ch.getSearchable()
    const languageCodes = searchable.languages ?? []
    const countryName = searchable._countryName ?? ''

    stmt.channel.run(
      ch.id,
      ch.name,
      jsonArray(ch.alt_names),
      ch.network ?? null,
      jsonArray(ch.owners),
      ch.country || null,
      jsonArray(ch.categories),
      ch.is_nsfw ? 1 : 0,
      ch.launched ?? null,
      ch.closed ?? null,
      ch.replaced_by ?? null,
      ch.website ?? null,
      ch.isClosed() ? 1 : 0,
      ch.isBlocked() ? 1 : 0,
      countryName || null
    )
    counts.channels++

    for (const cat of ch.categories ?? []) {
      stmt.channelCategory.run(ch.id, cat)
      counts.channel_categories++
    }
    for (const lang of languageCodes) {
      stmt.channelLanguage.run(ch.id, lang)
      counts.channel_languages++
    }

    ftsRows.push({
      channel_id: ch.id,
      name: ch.name,
      alt_names: (ch.alt_names ?? []).join(' '),
      country_name: countryName,
      categories: (ch.categories ?? []).join(' '),
      network: ch.network ?? '',
      owners: (ch.owners ?? []).join(' '),
      languages: [...languageCodes, ...(searchable._languageNames ?? [])].join(' ')
    })
  })

  // --- feeds ---
  data.feeds.forEach((f: Models.Feed) => {
    stmt.feed.run(
      f.channel,
      f.id,
      f.getStreamId(),
      f.name ?? null,
      jsonArray(f.alt_names),
      f.is_main ? 1 : 0,
      jsonArray(f.broadcast_area),
      jsonArray(f.languages),
      jsonArray(f.timezones),
      f.format ?? null
    )
    counts.feeds++
  })

  // --- streams ---
  data.streams.forEach((s: Models.Stream) => {
    stmt.stream.run(
      s.channel ?? null,
      s.feed ?? null,
      s.title ?? null,
      s.url,
      s.referrer ?? null,
      s.user_agent ?? null,
      s.quality ?? null,
      s.label ?? null
    )
    counts.streams++
  })

  // --- logos ---
  data.logos.forEach((l: Models.Logo) => {
    stmt.logo.run(
      l.channel ?? null,
      l.feed ?? null,
      l.in_use ? 1 : 0,
      jsonArray(l.tags),
      l.width ?? null,
      l.height ?? null,
      l.format ?? null,
      l.url
    )
    counts.logos++
  })

  // --- guides ---
  data.guides.forEach((g: Models.Guide) => {
    stmt.guide.run(
      g.channel ?? null,
      g.feed ?? null,
      g.site ?? null,
      g.site_id ?? null,
      g.site_name ?? null,
      g.lang ?? null,
      jsonArray(g.sources)
    )
    counts.guides++
  })

  // --- FTS index rebuild (issue #16) ---
  counts.channels_fts = rebuildFtsIndex(db, ftsRows)

  return counts
}

/**
 * Run the full load against the database. Migrates first (ensures schema), then
 * clears + reloads + rebuilds FTS in one transaction.
 *
 * @param dataDir directory holding the 13 JSON datasets.
 */
export async function load(dataDir = config.DATA_DIR): Promise<LoadCounts> {
  const absDir = resolve(process.cwd(), dataDir)
  logger.info({ dataDir: absDir }, 'ETL load: reading datasets via @iptv-org/sdk')

  const db = getConnection()
  runMigrations(db)

  const data = await loadProcessedData(absDir)

  const counts = db.transaction(() => {
    clearTables(db)
    return writeAll(db, data)
  })

  logger.info({ counts }, 'ETL load complete')
  return counts
}

/** CLI entrypoint for `npm run etl:load` (supports `--seed`/`--data-dir`). */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const seed = args.includes('--seed')
  const dirArgIndex = args.indexOf('--data-dir')
  const dataDir =
    dirArgIndex >= 0 && args[dirArgIndex + 1]
      ? (args[dirArgIndex + 1] as string)
      : seed
        ? '../../temp/data'
        : config.DATA_DIR

  const counts = await load(dataDir)
  // Human-friendly summary to stdout (logger may be silent in some envs).
  console.table(counts)
  closeConnection()
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (invokedDirectly) {
  void main()
}

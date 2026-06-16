import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Db } from '../../src/db/connection.js'
import { rebuildFtsIndex, type ChannelFtsRow } from '../../src/db/fts.js'

/**
 * Fixture loader for tests (issue #25, BE-15).
 *
 * Reads `tests/fixtures/seed.json` (a small, hand-built dataset whose keys
 * mirror the SQL schema column names) and inserts it into a migrated SQLite
 * database. No network, no full dataset. The FTS index is rebuilt from the
 * fixture's `fts` rows so search tests work against the same data.
 */

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(here, '../fixtures/seed.json')

interface CategoryRow {
  id: string
  name: string
}
interface CountryRow {
  code: string
  name: string
  flag: string | null
  languages: string[]
}
interface LanguageRow {
  code: string
  name: string
}
interface RegionRow {
  code: string
  name: string
  countries: string[]
}
interface RegionCountryRow {
  region_code: string
  country_code: string
}
interface SubdivisionRow {
  code: string
  name: string
  country: string | null
  parent: string | null
}
interface ChannelRow {
  id: string
  name: string
  alt_names: string[]
  network: string | null
  owners: string[]
  country: string | null
  categories: string[]
  is_nsfw: number
  launched: string | null
  closed: string | null
  replaced_by: string | null
  website: string | null
  is_closed: number
  is_blocked: number
  country_name: string | null
}
interface ChannelCategoryRow {
  channel_id: string
  category_id: string
}
interface ChannelLanguageRow {
  channel_id: string
  language_code: string
}
interface FeedRow {
  channel: string
  id: string
  stream_id: string | null
  name: string | null
  alt_names: string[]
  is_main: number
  broadcast_area: string[]
  languages: string[]
  timezones: string[]
  format: string | null
}
interface StreamRow {
  channel: string | null
  feed: string | null
  title: string | null
  url: string
  quality: string | null
}
interface LogoRow {
  channel: string | null
  feed: string | null
  in_use: number
  tags: string[]
  width: number | null
  height: number | null
  format: string | null
  url: string
}
interface GuideRow {
  channel: string | null
  feed: string | null
  site: string | null
  site_id: string | null
  site_name: string | null
  lang: string | null
  sources: string[]
}

export interface SeedFixture {
  categories: CategoryRow[]
  countries: CountryRow[]
  languages: LanguageRow[]
  regions: RegionRow[]
  region_countries: RegionCountryRow[]
  subdivisions: SubdivisionRow[]
  channels: ChannelRow[]
  channel_categories: ChannelCategoryRow[]
  channel_languages: ChannelLanguageRow[]
  feeds: FeedRow[]
  streams: StreamRow[]
  logos: LogoRow[]
  guides: GuideRow[]
  fts: ChannelFtsRow[]
}

/** Parse the JSON fixture from disk. */
export function loadSeedFixture(): SeedFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as SeedFixture
}

/**
 * Insert the fixture into a (migrated) database inside one transaction and
 * rebuild the FTS index. Idempotent for a fresh database; do not call twice on
 * the same connection without clearing.
 */
export function seedDatabase(db: Db, fixture: SeedFixture = loadSeedFixture()): void {
  db.transaction(() => {
    for (const c of fixture.categories) {
      db.prepare(`INSERT INTO categories (id, name) VALUES (?, ?)`).run(c.id, c.name)
    }
    for (const c of fixture.countries) {
      db.prepare(`INSERT INTO countries (code, name, flag, languages) VALUES (?, ?, ?, ?)`).run(
        c.code,
        c.name,
        c.flag,
        JSON.stringify(c.languages)
      )
    }
    for (const l of fixture.languages) {
      db.prepare(`INSERT INTO languages (code, name) VALUES (?, ?)`).run(l.code, l.name)
    }
    for (const r of fixture.regions) {
      db.prepare(`INSERT INTO regions (code, name, countries) VALUES (?, ?, ?)`).run(
        r.code,
        r.name,
        JSON.stringify(r.countries)
      )
    }
    for (const rc of fixture.region_countries) {
      db.prepare(
        `INSERT INTO region_countries (region_code, country_code) VALUES (?, ?)`
      ).run(rc.region_code, rc.country_code)
    }
    for (const s of fixture.subdivisions) {
      db.prepare(
        `INSERT INTO subdivisions (code, name, country, parent) VALUES (?, ?, ?, ?)`
      ).run(s.code, s.name, s.country, s.parent)
    }
    for (const ch of fixture.channels) {
      db.prepare(
        `INSERT INTO channels
          (id, name, alt_names, network, owners, country, categories, is_nsfw,
           launched, closed, replaced_by, website, is_closed, is_blocked, country_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ch.id,
        ch.name,
        JSON.stringify(ch.alt_names),
        ch.network,
        JSON.stringify(ch.owners),
        ch.country,
        JSON.stringify(ch.categories),
        ch.is_nsfw,
        ch.launched,
        ch.closed,
        ch.replaced_by,
        ch.website,
        ch.is_closed,
        ch.is_blocked,
        ch.country_name
      )
    }
    for (const cc of fixture.channel_categories) {
      db.prepare(
        `INSERT INTO channel_categories (channel_id, category_id) VALUES (?, ?)`
      ).run(cc.channel_id, cc.category_id)
    }
    for (const cl of fixture.channel_languages) {
      db.prepare(
        `INSERT INTO channel_languages (channel_id, language_code) VALUES (?, ?)`
      ).run(cl.channel_id, cl.language_code)
    }
    for (const f of fixture.feeds) {
      db.prepare(
        `INSERT INTO feeds (channel, id, stream_id, name, alt_names, is_main, broadcast_area, languages, timezones, format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        f.channel,
        f.id,
        f.stream_id,
        f.name,
        JSON.stringify(f.alt_names),
        f.is_main,
        JSON.stringify(f.broadcast_area),
        JSON.stringify(f.languages),
        JSON.stringify(f.timezones),
        f.format
      )
    }
    for (const s of fixture.streams) {
      db.prepare(
        `INSERT INTO streams (channel, feed, title, url, quality) VALUES (?, ?, ?, ?, ?)`
      ).run(s.channel, s.feed, s.title, s.url, s.quality)
    }
    for (const l of fixture.logos) {
      db.prepare(
        `INSERT INTO logos (channel, feed, in_use, tags, width, height, format, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        l.channel,
        l.feed,
        l.in_use,
        JSON.stringify(l.tags),
        l.width,
        l.height,
        l.format,
        l.url
      )
    }
    for (const g of fixture.guides) {
      db.prepare(
        `INSERT INTO guides (channel, feed, site, site_id, site_name, lang, sources) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(g.channel, g.feed, g.site, g.site_id, g.site_name, g.lang, JSON.stringify(g.sources))
    }

    rebuildFtsIndex(db, fixture.fts)
  })
}

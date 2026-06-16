import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConnection, type Db } from '../connection.js'
import { runMigrations } from '../migrate.js'
import { rebuildFtsIndex, type ChannelFtsRow } from '../fts.js'
import { ChannelsRepository } from './channels.repo.js'
import { DimensionsRepository } from './dimensions.repo.js'
import { SearchRepository } from './search.repo.js'
import { FavoritesRepository } from './favorites.repo.js'

/**
 * Data-layer tests (BE-04/05/06/07). Builds a small temp database, applies the
 * real schema, seeds a handful of rows by hand (no network, no full dataset)
 * and exercises the repositories, mappers and FTS index.
 */

let tmpDir: string
let db: Db

function seed(db: Db): void {
  db.transaction(() => {
    db.exec(`DELETE FROM channels; DELETE FROM categories; DELETE FROM countries;
             DELETE FROM languages; DELETE FROM channel_categories;
             DELETE FROM channel_languages; DELETE FROM streams; DELETE FROM logos;
             DELETE FROM guides; DELETE FROM regions; DELETE FROM region_countries;
             DELETE FROM feeds;`)

    db.prepare(`INSERT INTO categories (id, name) VALUES (?, ?)`).run('news', 'News')
    db.prepare(`INSERT INTO categories (id, name) VALUES (?, ?)`).run('sports', 'Sports')
    db.prepare(`INSERT INTO countries (code, name, flag, languages) VALUES (?, ?, ?, ?)`).run(
      'US',
      'United States',
      '🇺🇸',
      '["eng"]'
    )
    db.prepare(`INSERT INTO countries (code, name, flag, languages) VALUES (?, ?, ?, ?)`).run(
      'ES',
      'Spain',
      '🇪🇸',
      '["spa"]'
    )
    db.prepare(`INSERT INTO languages (code, name) VALUES (?, ?)`).run('eng', 'English')
    db.prepare(`INSERT INTO languages (code, name) VALUES (?, ?)`).run('spa', 'Spanish')

    db.prepare(`INSERT INTO regions (code, name, countries) VALUES (?, ?, ?)`).run(
      'NA',
      'North America',
      '["US"]'
    )
    db.prepare(`INSERT INTO region_countries (region_code, country_code) VALUES (?, ?)`).run(
      'NA',
      'US'
    )

    const insChannel = db.prepare(
      `INSERT INTO channels
        (id, name, alt_names, network, owners, country, categories, is_nsfw,
         launched, closed, replaced_by, website, is_closed, is_blocked, country_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    // CNN — visible news channel in US.
    insChannel.run(
      'CNN.us',
      'CNN',
      '["Cable News Network"]',
      'Cable News Network',
      '[]',
      'US',
      '["news"]',
      0,
      '1980-06-01',
      null,
      null,
      'https://cnn.com',
      0,
      0,
      'United States'
    )
    // Televisión Española — accented name, Spanish.
    insChannel.run(
      'TVE.es',
      'Televisión Española',
      '["La 1"]',
      'RTVE',
      '[]',
      'ES',
      '["news"]',
      0,
      null,
      null,
      null,
      null,
      0,
      0,
      'Spain'
    )
    // Blocked channel — must never appear.
    insChannel.run(
      'Blocked.us',
      'Blocked Channel',
      '[]',
      null,
      '[]',
      'US',
      '["sports"]',
      0,
      null,
      null,
      null,
      null,
      0,
      1,
      'United States'
    )

    db.prepare(`INSERT INTO channel_categories (channel_id, category_id) VALUES (?, ?)`).run(
      'CNN.us',
      'news'
    )
    db.prepare(`INSERT INTO channel_categories (channel_id, category_id) VALUES (?, ?)`).run(
      'TVE.es',
      'news'
    )
    db.prepare(`INSERT INTO channel_languages (channel_id, language_code) VALUES (?, ?)`).run(
      'CNN.us',
      'eng'
    )
    db.prepare(`INSERT INTO channel_languages (channel_id, language_code) VALUES (?, ?)`).run(
      'TVE.es',
      'spa'
    )

    db.prepare(
      `INSERT INTO streams (channel, feed, title, url, quality) VALUES (?, ?, ?, ?, ?)`
    ).run('CNN.us', null, 'CNN HD', 'https://example.com/cnn.m3u8', '720p')
    // TVE.es needs a stream so it is playable: /api/search now only returns
    // channels with at least one stream (same hasStreams guarantee as /api/channels).
    db.prepare(
      `INSERT INTO streams (channel, feed, title, url, quality) VALUES (?, ?, ?, ?, ?)`
    ).run('TVE.es', null, 'TVE', 'https://example.com/tve.m3u8', '720p')
    db.prepare(
      `INSERT INTO logos (channel, feed, in_use, tags, width, height, format, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('CNN.us', null, 1, '[]', 100, 50, 'PNG', 'https://example.com/cnn.png')
    db.prepare(
      `INSERT INTO guides (channel, feed, site, site_id, site_name, lang, sources) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('CNN.us', null, 'tvguide.com', 'cnn', 'TV Guide', 'en', '[]')

    const ftsRows: ChannelFtsRow[] = [
      {
        channel_id: 'CNN.us',
        name: 'CNN',
        alt_names: 'Cable News Network',
        country_name: 'United States',
        categories: 'news',
        network: 'Cable News Network',
        owners: '',
        languages: 'eng English'
      },
      {
        channel_id: 'TVE.es',
        name: 'Televisión Española',
        alt_names: 'La 1',
        country_name: 'Spain',
        categories: 'news',
        network: 'RTVE',
        owners: '',
        languages: 'spa Spanish'
      }
    ]
    rebuildFtsIndex(db, ftsRows)
  })
}

beforeAll(() => {
  // Use a dedicated, uncached connection at a temp path so this test never
  // touches the configured DB path or the app singleton (no cross-file leakage).
  tmpDir = mkdtempSync(join(tmpdir(), 'iptv-repo-test-'))
  db = createConnection(join(tmpDir, 'test.db'))
  runMigrations(db)
  seed(db)
})

afterAll(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('schema + migrations (issue #14)', () => {
  it('creates all expected tables idempotently', () => {
    // Re-running migrations must not throw.
    expect(() => runMigrations(db)).not.toThrow()
    const tables = (
      db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all() as { name: string }[]
    ).map(r => r.name)
    for (const t of [
      'channels',
      'streams',
      'feeds',
      'logos',
      'guides',
      'categories',
      'countries',
      'languages',
      'regions',
      'subdivisions',
      'cities',
      'channel_categories',
      'channel_languages',
      'region_countries',
      'favorites'
    ]) {
      expect(tables).toContain(t)
    }
  })
})

describe('ChannelsRepository (issue #17)', () => {
  const repo = () => new ChannelsRepository(db)

  it('lists only non-blocked channels and parses JSON columns', () => {
    const result = repo().listChannels()
    expect(result.total).toBe(2)
    const ids = result.items.map(c => c.id)
    expect(ids).toContain('CNN.us')
    expect(ids).not.toContain('Blocked.us')
    const cnn = result.items.find(c => c.id === 'CNN.us')!
    expect(cnn.altNames).toEqual(['Cable News Network'])
    expect(cnn.categories).toEqual(['news'])
    expect(cnn.countryName).toBe('United States')
    expect(cnn.streamCount).toBe(1)
    expect(cnn.logoUrl).toBe('https://example.com/cnn.png')
  })

  it('filters by country and category', () => {
    expect(repo().listChannels({ country: 'ES' }).total).toBe(1)
    expect(repo().listChannels({ category: 'news' }).total).toBe(2)
    expect(repo().listChannels({ category: 'sports' }).total).toBe(0)
  })

  it('filters by language', () => {
    const r = repo().listChannels({ language: 'spa' })
    expect(r.total).toBe(1)
    expect(r.items[0]!.id).toBe('TVE.es')
  })

  it('paginates and sorts', () => {
    const page1 = repo().listChannels({}, { field: 'name', direction: 'asc' }, { page: 1, pageSize: 1 })
    expect(page1.items).toHaveLength(1)
    expect(page1.total).toBe(2)
    expect(page1.items[0]!.id).toBe('CNN.us') // CNN < Televisión
  })

  it('gets a channel by id with its languages, streams, logos and guide', () => {
    const repoInst = repo()
    const cnn = repoInst.getChannelById('CNN.us')
    expect(cnn).not.toBeNull()
    expect(cnn!.languages).toEqual(['eng'])
    expect(repoInst.getChannelStreams('CNN.us')).toHaveLength(1)
    expect(repoInst.getChannelStreams('CNN.us')[0]!.url).toBe('https://example.com/cnn.m3u8')
    expect(repoInst.getChannelLogos('CNN.us')[0]!.inUse).toBe(true)
    expect(repoInst.getChannelGuide('CNN.us')[0]!.siteName).toBe('TV Guide')
    expect(repoInst.getChannelById('does-not-exist')).toBeNull()
  })
})

describe('DimensionsRepository (issue #17)', () => {
  const repo = () => new DimensionsRepository(db)

  it('lists categories with non-blocked channel counts', () => {
    const cats = repo().listDimension('categories')
    const news = cats.find(c => c.code === 'news')!
    expect(news.channelCount).toBe(2)
    const sports = cats.find(c => c.code === 'sports')!
    expect(sports.channelCount).toBe(0) // only the blocked channel had sports
  })

  it('lists countries with flags and counts (blocked excluded)', () => {
    const countries = repo().listDimension('countries')
    const us = countries.find(c => c.code === 'US')!
    expect(us.channelCount).toBe(1) // CNN visible, Blocked excluded
    expect(us.meta?.flag).toBe('🇺🇸')
  })

  it('lists languages, regions and the raw rollup', () => {
    expect(repo().listDimension('languages').find(l => l.code === 'eng')!.channelCount).toBe(1)
    expect(repo().listDimension('regions').find(r => r.code === 'NA')!.channelCount).toBe(1)
    const raw = repo().listDimension('raw')
    expect(raw).toHaveLength(1)
    expect(raw[0]!.channelCount).toBe(2)
  })

  it('lists sources (guide sites)', () => {
    const sources = repo().listDimension('sources')
    expect(sources.find(s => s.code === 'tvguide.com')!.channelCount).toBe(1)
  })
})

describe('SearchRepository + FTS (issues #16/#17)', () => {
  const repo = () => new SearchRepository(db)

  it('finds channels by name', () => {
    const r = repo().search('cnn')
    expect(r.items.map(c => c.id)).toContain('CNN.us')
  })

  it('is accent- and case-insensitive', () => {
    // search unaccented + lowercase should match "Televisión Española"
    const r = repo().search('television')
    expect(r.items.map(c => c.id)).toContain('TVE.es')
  })

  it('returns ranked ids and resolves to DTOs', () => {
    const ids = repo().searchIds('news')
    // both channels mention news (category) -> both indexed
    expect(ids.length).toBeGreaterThanOrEqual(1)
  })

  it('excludes channels without any stream (playable-only, like /api/channels)', () => {
    // Index a channel in the FTS table but give it no stream row.
    db.prepare(
      `INSERT INTO channels (id, name, alt_names, network, owners, country, categories, is_nsfw, launched, closed, replaced_by, website, is_closed, is_blocked, country_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Ghost.us', 'Ghost News', '[]', null, '[]', 'US', '["news"]', 0, null, null, null, null, 0, 0, 'United States')
    db.prepare(
      `INSERT INTO channels_fts (name, alt_names, country_name, categories, network, owners, languages, channel_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Ghost News', '', 'United States', 'news', '', '', '', 'Ghost.us')

    try {
      const ids = repo().search('ghost').items.map(c => c.id)
      expect(ids).not.toContain('Ghost.us')
    } finally {
      db.prepare(`DELETE FROM channels_fts WHERE channel_id = ?`).run('Ghost.us')
      db.prepare(`DELETE FROM channels WHERE id = ?`).run('Ghost.us')
    }
  })

  it('does not return duplicate channel ids even if the FTS index emits a hit twice', () => {
    // Duplicate the CNN entry in the FTS index; the resolved result must dedup.
    db.prepare(
      `INSERT INTO channels_fts (name, alt_names, country_name, categories, network, owners, languages, channel_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('CNN', 'Cable News Network', 'United States', 'news', 'Cable News Network', '', 'eng English', 'CNN.us')

    try {
      const ids = repo().search('cnn').items.map(c => c.id)
      const cnnHits = ids.filter(id => id === 'CNN.us')
      expect(cnnHits).toHaveLength(1)
    } finally {
      // Remove only the duplicate row we just added (keep the original).
      db.prepare(
        `DELETE FROM channels_fts
          WHERE rowid IN (
            SELECT rowid FROM channels_fts WHERE channel_id = ? ORDER BY rowid DESC LIMIT 1
          )`
      ).run('CNN.us')
    }
  })
})

describe('FavoritesRepository (issue #17)', () => {
  const repo = () => new FavoritesRepository(db)

  it('adds, lists, checks and removes favorites', () => {
    const r = repo()
    expect(r.isFavorite('CNN.us')).toBe(false)
    expect(r.addFavorite('CNN.us')).toBe(true)
    expect(r.addFavorite('CNN.us')).toBe(false) // idempotent
    expect(r.isFavorite('CNN.us')).toBe(true)
    const favs = r.listFavorites()
    expect(favs.map(c => c.id)).toEqual(['CNN.us'])
    expect(r.removeFavorite('CNN.us')).toBe(true)
    expect(r.isFavorite('CNN.us')).toBe(false)
  })
})

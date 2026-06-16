import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { Db } from '../db/connection.js'

/**
 * Endpoint tests (BE-08..BE-14 / issues #18-#24).
 *
 * Drives the real Fastify app via `app.inject()` against a temp SQLite database
 * seeded by hand (no network, no full dataset). The configured DATABASE_PATH is
 * pointed at the temp file *before* the config/connection modules load, so the
 * app's repositories read from the seeded db.
 */

let tmpDir: string
let app: FastifyInstance
let closeConnection: () => void

function seed(db: Db): void {
  db.transaction(() => {
    db.prepare(`INSERT INTO categories (id, name) VALUES (?, ?)`).run('news', 'News')
    db.prepare(`INSERT INTO categories (id, name) VALUES (?, ?)`).run('movies', 'Movies')
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
    db.prepare(`INSERT INTO subdivisions (code, name, country, parent) VALUES (?, ?, ?, ?)`).run(
      'US-CA',
      'California',
      'US',
      null
    )

    const insChannel = db.prepare(
      `INSERT INTO channels
        (id, name, alt_names, network, owners, country, categories, is_nsfw,
         launched, closed, replaced_by, website, is_closed, is_blocked, country_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
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
    // Channel with no streams -> excluded by has_streams default.
    insChannel.run(
      'NoStream.us',
      'No Stream Channel',
      '[]',
      null,
      '[]',
      'US',
      '["movies"]',
      0,
      null,
      null,
      null,
      null,
      0,
      0,
      'United States'
    )
    // Blocked -> never visible.
    insChannel.run(
      'Blocked.us',
      'Blocked Channel',
      '[]',
      null,
      '[]',
      'US',
      '["news"]',
      0,
      null,
      null,
      null,
      null,
      0,
      1,
      'United States'
    )

    for (const [ch, cat] of [
      ['CNN.us', 'news'],
      ['TVE.es', 'news'],
      ['NoStream.us', 'movies']
    ] as const) {
      db.prepare(
        `INSERT INTO channel_categories (channel_id, category_id) VALUES (?, ?)`
      ).run(ch, cat)
    }
    db.prepare(`INSERT INTO channel_languages (channel_id, language_code) VALUES (?, ?)`).run(
      'CNN.us',
      'eng'
    )
    db.prepare(`INSERT INTO channel_languages (channel_id, language_code) VALUES (?, ?)`).run(
      'TVE.es',
      'spa'
    )

    db.prepare(
      `INSERT INTO feeds (channel, id, stream_id, name, alt_names, is_main, broadcast_area, languages, timezones, format)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('CNN.us', 'SD', 'CNN.us@SD', 'SD', '[]', 1, '["c/US"]', '["eng"]', '[]', '720p')

    db.prepare(
      `INSERT INTO streams (channel, feed, title, url, quality) VALUES (?, ?, ?, ?, ?)`
    ).run('CNN.us', null, 'CNN HD', 'https://example.com/cnn.m3u8', '1080p')
    db.prepare(
      `INSERT INTO streams (channel, feed, title, url, quality) VALUES (?, ?, ?, ?, ?)`
    ).run('CNN.us', null, 'CNN SD', 'https://example.com/cnn-sd.m3u8', '480p')
    db.prepare(
      `INSERT INTO streams (channel, feed, title, url, quality) VALUES (?, ?, ?, ?, ?)`
    ).run('TVE.es', null, 'TVE', 'https://example.com/tve.m3u8', '720p')

    db.prepare(
      `INSERT INTO logos (channel, feed, in_use, tags, width, height, format, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('CNN.us', null, 1, '[]', 100, 50, 'PNG', 'https://example.com/cnn.png')
    db.prepare(
      `INSERT INTO guides (channel, feed, site, site_id, site_name, lang, sources) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('CNN.us', null, 'tvguide.com', 'cnn', 'TV Guide', 'en', '[]')
  })
}

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'iptv-routes-test-'))
  const dbPath = join(tmpDir, 'iptv.db')
  process.env.DATABASE_PATH = dbPath

  // Import after setting env so config/connection resolve the temp path.
  const conn = await import('../db/connection.js')
  const { runMigrations } = await import('../db/migrate.js')
  const { rebuildFtsIndex } = await import('../db/fts.js')
  closeConnection = conn.closeConnection

  const db = conn.getConnection()
  runMigrations(db)
  seed(db)
  // Build the FTS index from the seeded rows.
  rebuildFtsIndex(db, [
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
  ])

  const { buildApp } = await import('../app.js')
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
  closeConnection()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/channels (issue #18)', () => {
  it('returns a cursor-paginated page of ChannelSummary', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body).toHaveProperty('nextCursor')
    expect(body).toHaveProperty('total')
    const cnn = body.data.find((c: { id: string }) => c.id === 'CNN.us')
    expect(cnn).toBeTruthy()
    // ChannelSummary shape.
    expect(cnn).toMatchObject({
      id: 'CNN.us',
      name: 'CNN',
      country: 'US',
      is_nsfw: false,
      hasStream: true
    })
    expect(cnn.quality).toBe('1080p') // best of 1080p/480p
    expect(cnn.logo).toBe('https://example.com/cnn.png')
  })

  it('excludes blocked channels and (by default) channels without streams', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=100' })
    const ids = res.json().data.map((c: { id: string }) => c.id)
    expect(ids).not.toContain('Blocked.us')
    expect(ids).not.toContain('NoStream.us')
  })

  it('filters by country and category', async () => {
    const es = await app.inject({ method: 'GET', url: '/api/channels?country=ES' })
    expect(es.json().data.map((c: { id: string }) => c.id)).toEqual(['TVE.es'])
    const news = await app.inject({ method: 'GET', url: '/api/channels?category=news' })
    expect(news.json().data.length).toBe(2)
  })

  it('filters by language and region', async () => {
    const spa = await app.inject({ method: 'GET', url: '/api/channels?language=spa' })
    expect(spa.json().data.map((c: { id: string }) => c.id)).toEqual(['TVE.es'])
    const na = await app.inject({ method: 'GET', url: '/api/channels?region=NA' })
    expect(na.json().data.map((c: { id: string }) => c.id)).toEqual(['CNN.us'])
  })

  it('rejects invalid params with a 400 ApiError', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=999' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.status).toBe(400)
    expect(typeof body.code).toBe('string')
  })

  it('paginates with page/limit and reports a next cursor', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?page=1&limit=1' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.nextCursor).toBe('1')
  })
})

describe('GET /api/channels/:id and sub-resources (issue #21)', () => {
  it('returns full ChannelDetail with feeds, logos, streamCount', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels/CNN.us' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe('CNN.us')
    expect(body.streamCount).toBe(2)
    expect(body.logo).toBe('https://example.com/cnn.png')
    expect(body.feeds[0]).toMatchObject({ channel: 'CNN.us', id: 'SD', is_main: true })
    expect(body.logos[0]).toMatchObject({ in_use: true, url: 'https://example.com/cnn.png' })
  })

  it('returns the streams list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels/CNN.us/streams' })
    expect(res.statusCode).toBe(200)
    const streams = res.json()
    expect(streams).toHaveLength(2)
    expect(streams[0]).toMatchObject({ channel: 'CNN.us', url: 'https://example.com/cnn.m3u8' })
  })

  it('returns the EPG guide reference', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels/CNN.us/epg' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.channel).toBe('CNN.us')
    expect(body.site).toBe('tvguide.com')
    expect(Array.isArray(body.programs)).toBe(true)
  })

  it('404s for an unknown channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels/does-not-exist' })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('NOT_FOUND')
  })
})

describe('Dimension catalogues (issue #19)', () => {
  it('GET /api/dimensions returns exactly the 8 dimensions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dimensions' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(8)
    const ids = body.map((d: { id: string }) => d.id).sort()
    expect(ids).toEqual([
      'categories',
      'cities',
      'countries',
      'languages',
      'raw',
      'regions',
      'sources',
      'subdivisions'
    ])
  })

  it('GET /api/dimensions/categories returns DimensionItem[] with counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dimensions/categories' })
    expect(res.statusCode).toBe(200)
    const news = res.json().find((d: { id: string }) => d.id === 'news')
    expect(news.channelCount).toBe(2)
  })

  it('GET /api/countries carries the flag glyph', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/countries' })
    const us = res.json().find((d: { id: string }) => d.id === 'US')
    expect(us.glyph).toBe('🇺🇸')
    expect(us.channelCount).toBe(2) // CNN + NoStream visible, Blocked excluded
  })

  it('rejects an unknown dimension with a 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dimensions/bogus' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/dimensions/countries/US/channels lists that country', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dimensions/countries/US/channels'
    })
    expect(res.statusCode).toBe(200)
    const ids = res.json().data.map((c: { id: string }) => c.id)
    expect(ids).toContain('CNN.us')
    expect(ids).not.toContain('TVE.es')
  })
})

describe('Search (issue #20)', () => {
  it('finds channels by name ordered by relevance', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=cnn' })
    expect(res.statusCode).toBe(200)
    const ids = res.json().data.map((c: { id: string }) => c.id)
    expect(ids).toContain('CNN.us')
  })

  it('is accent-insensitive', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=television' })
    const ids = res.json().data.map((c: { id: string }) => c.id)
    expect(ids).toContain('TVE.es')
  })

  it('does not 500 on special characters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/search?q=${encodeURIComponent('("news")*')}`
    })
    expect(res.statusCode).toBe(200)
  })

  it('400s when q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search' })
    expect(res.statusCode).toBe(400)
  })
})

describe('Favorites (issue #23)', () => {
  it('add -> list -> ids -> remove round trip', async () => {
    const add = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      payload: { channelId: 'CNN.us' }
    })
    expect([200, 201]).toContain(add.statusCode)

    // Idempotent: second add does not fail.
    const add2 = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      payload: { channelId: 'CNN.us' }
    })
    expect(add2.statusCode).toBe(200)

    const list = await app.inject({ method: 'GET', url: '/api/favorites' })
    expect(list.json().map((c: { id: string }) => c.id)).toContain('CNN.us')

    const ids = await app.inject({ method: 'GET', url: '/api/favorites/ids' })
    expect(ids.json()).toContain('CNN.us')

    const del = await app.inject({ method: 'DELETE', url: '/api/favorites/CNN.us' })
    expect(del.statusCode).toBe(200)

    const after = await app.inject({ method: 'GET', url: '/api/favorites/ids' })
    expect(after.json()).not.toContain('CNN.us')
  })

  it('404s when favoriting a non-existent channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      payload: { channelId: 'nope' }
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('NOT_FOUND')
  })
})

describe('Stream proxy SSRF guard (issue #22)', () => {
  it('rejects loopback URLs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/proxy?url=${encodeURIComponent('http://127.0.0.1/secret.m3u8')}`
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('BAD_REQUEST')
  })

  it('rejects private IPs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/proxy?url=${encodeURIComponent('http://192.168.1.5/x.m3u8')}`
    })
    expect(res.statusCode).toBe(400)
  })

  it('400s when url is missing/invalid', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/proxy?url=not-a-url' })
    expect(res.statusCode).toBe(400)
  })
})

describe('Stream status (issue #24)', () => {
  it('400s on invalid url', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/streams/status?url=nope' })
    expect(res.statusCode).toBe(400)
  })

  it('returns offline (not 500) for a private/blocked url', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/streams/status?url=${encodeURIComponent('http://10.0.0.1/x.m3u8')}`
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('offline')
    expect(body).toHaveProperty('checkedAt')
  })

  it('404s for an unknown stream id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/streams/999999/status' })
    expect(res.statusCode).toBe(404)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, type TestApp } from '../helpers/buildTestApp.js'

/**
 * API route tests via the `buildTestApp()` helper + JSON fixture (issue #25).
 *
 * Drives the real Fastify app with `app.inject()` against a temp SQLite database
 * seeded from `tests/fixtures/seed.json`. Self-contained: no network, no full
 * dataset, no dependence on test execution order.
 */

let harness: TestApp
let app: FastifyInstance

beforeAll(async () => {
  harness = await buildTestApp()
  app = harness.app
})

afterAll(async () => {
  await harness.teardown()
})

describe('health', () => {
  it('GET /api/health reports ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
  })
})

describe('GET /api/channels — filters, pagination, order', () => {
  it('returns a cursor-paginated page of ChannelSummary', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body).toHaveProperty('nextCursor')
    expect(body).toHaveProperty('total')
    const cnn = body.data.find((c: { id: string }) => c.id === 'CNN.us')
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

  it('hides blocked channels and (by default) stream-less channels', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=100' })
    const ids = res.json().data.map((c: { id: string }) => c.id)
    expect(ids).not.toContain('Blocked.us')
    expect(ids).not.toContain('NoStream.us')
  })

  it('filters by country, category, language and region', async () => {
    const es = await app.inject({ method: 'GET', url: '/api/channels?country=ES' })
    expect(es.json().data.map((c: { id: string }) => c.id)).toEqual(['TVE.es'])

    const news = await app.inject({ method: 'GET', url: '/api/channels?category=news' })
    expect(news.json().data.length).toBe(2)

    const spa = await app.inject({ method: 'GET', url: '/api/channels?language=spa' })
    expect(spa.json().data.map((c: { id: string }) => c.id)).toEqual(['TVE.es'])

    const na = await app.inject({ method: 'GET', url: '/api/channels?region=NA' })
    expect(na.json().data.map((c: { id: string }) => c.id)).toEqual(['CNN.us'])
  })

  it('orders by name and paginates with a stable cursor', async () => {
    const asc = await app.inject({
      method: 'GET',
      url: '/api/channels?sort=name&order=asc&page=1&limit=1'
    })
    const body = asc.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('CNN.us') // CNN sorts first
    // More visible rows remain -> a non-null next cursor (next offset as string).
    expect(body.nextCursor).toBe('1')

    // Descending order flips the first row to the last name.
    const desc = await app.inject({
      method: 'GET',
      url: '/api/channels?sort=name&order=desc&limit=1'
    })
    expect(desc.json().data[0].id).toBe('TVE.es') // Televisión sorts last asc
  })

  it('rejects invalid params with a 400 ApiError (Zod)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=999' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.status).toBe(400)
    expect(typeof body.code).toBe('string')
    expect(typeof body.message).toBe('string')
  })
})

describe('Dimension catalogues with counts', () => {
  it('GET /api/dimensions returns the 8 navigation dimensions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dimensions' })
    expect(res.statusCode).toBe(200)
    const ids = res
      .json()
      .map((d: { id: string }) => d.id)
      .sort()
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

  it('GET /api/dimensions/categories carries channel counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dimensions/categories' })
    expect(res.statusCode).toBe(200)
    const news = res.json().find((d: { id: string }) => d.id === 'news')
    expect(news.channelCount).toBe(2)
  })

  it('GET /api/countries carries the flag glyph and counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/countries' })
    const us = res.json().find((d: { id: string }) => d.id === 'US')
    expect(us.glyph).toBe('🇺🇸')
    expect(us.channelCount).toBe(2) // CNN + NoStream visible; Blocked excluded
  })

  it('GET /api/dimensions/countries/US/channels scopes to that country', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dimensions/countries/US/channels'
    })
    const ids = res.json().data.map((c: { id: string }) => c.id)
    expect(ids).toContain('CNN.us')
    expect(ids).not.toContain('TVE.es')
  })

  it('rejects an unknown dimension with a 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dimensions/bogus' })
    expect(res.statusCode).toBe(400)
  })
})

describe('Search (FTS5)', () => {
  it('finds channels by name', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=cnn' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.map((c: { id: string }) => c.id)).toContain('CNN.us')
  })

  it('is accent- and case-insensitive', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=TELEVISION' })
    expect(res.json().data.map((c: { id: string }) => c.id)).toContain('TVE.es')
  })

  it('does not 500 on FTS special characters', async () => {
    for (const q of ['("news")*', 'a AND b', 'c:d', '"', '*']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/search?q=${encodeURIComponent(q)}`
      })
      expect(res.statusCode).toBe(200)
    }
  })

  it('400s when q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search' })
    expect(res.statusCode).toBe(400)
  })
})

describe('Channel detail (200 and 404)', () => {
  it('returns the full ChannelDetail with feeds, logos and streamCount', async () => {
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
    expect(res.json()).toHaveLength(2)
  })

  it('404s for an unknown channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels/does-not-exist' })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('NOT_FOUND')
  })
})

describe('Favorites (idempotent CRUD)', () => {
  it('add -> list -> ids -> remove round trip', async () => {
    const add = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      payload: { channelId: 'CNN.us' }
    })
    expect([200, 201]).toContain(add.statusCode)

    // Idempotent re-add must not error.
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

  it('400s on a malformed favorites payload (Zod)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      payload: { wrong: 'shape' }
    })
    expect(res.statusCode).toBe(400)
  })
})

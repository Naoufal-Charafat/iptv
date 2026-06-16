import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { closeDb } from './db/client.js'

describe('backend app (issues #11, #13)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    closeDb()
  })

  it('GET /api/health responds 200 without depending on the database', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.uptime).toBe('number')
    expect(typeof body.version).toBe('string')
    expect(typeof body.timestamp).toBe('string')
  })

  it('echoes a request id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.headers['x-request-id']).toBeTruthy()
  })

  it('GET /api/health/db returns 503 (not a crash) when the db is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/db' })
    // No db file in the test environment -> service unavailable, JSON body.
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.status).toBe('error')
    expect(typeof body.message).toBe('string')
  })

  it('unknown routes return a consistent ApiError 404 body', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe('NOT_FOUND')
    expect(body.status).toBe(404)
    expect(typeof body.message).toBe('string')
  })

  it('maps thrown route errors to the ApiError envelope, not an opaque 500', async () => {
    // Build a dedicated instance so the test route is registered before ready().
    const probe = await buildApp()
    const { errors } = await import('./lib/errors.js')
    probe.get('/__boom', async () => {
      throw errors.badRequest('nope', { field: 'x' })
    })
    await probe.ready()

    const res = await probe.inject({ method: 'GET', url: '/__boom' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe('BAD_REQUEST')
    expect(body.status).toBe(400)
    expect(body.message).toBe('nope')
    expect(body.details).toEqual({ field: 'x' })

    await probe.close()
  })
})

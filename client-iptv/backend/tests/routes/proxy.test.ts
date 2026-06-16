import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'

/**
 * Stream-proxy tests against a real mock HTTP origin (issue #25, BE-12/#22).
 *
 * A `node:http` server on loopback serves a tiny HLS manifest + a binary
 * segment. The proxy route's SSRF guard normally blocks loopback, so for the
 * happy-path manifest-rewrite test we mock `checkUrl` to accept the mock origin
 * (still using the REAL `rewriteManifest`). SSRF rejection is verified
 * separately with the real guard, with no mocking.
 */

let origin: Server
let originBase: string

const MANIFEST = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-KEY:METHOD=AES-128,URI="enc.key"',
  '#EXT-X-MAP:URI="init.mp4"',
  '#EXTINF:6.0,',
  'segment0.ts',
  '#EXTINF:6.0,',
  'sub/segment1.ts',
  '#EXT-X-ENDLIST'
].join('\n')

beforeAll(async () => {
  origin = createServer((req, res) => {
    if (req.url === '/live/index.m3u8') {
      res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' })
      res.end(MANIFEST)
      return
    }
    if (req.url?.startsWith('/live/segment0.ts')) {
      res.writeHead(200, { 'content-type': 'video/mp2t' })
      res.end(Buffer.from([0x47, 0x40, 0x00, 0x10])) // MPEG-TS sync byte + bytes
      return
    }
    res.writeHead(404)
    res.end('not found')
  })
  await new Promise<void>(resolve => origin.listen(0, '127.0.0.1', resolve))
  const addr = origin.address() as AddressInfo
  originBase = `http://127.0.0.1:${addr.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    origin.close(err => (err ? reject(err) : resolve()))
  )
})

describe('GET /api/proxy — manifest rewrite (mock origin)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // Build a minimal app exposing only the proxy route, with the SSRF guard
    // stubbed to accept the loopback mock origin (everything else is real).
    vi.resetModules()
    process.env.NODE_ENV = 'test'
    vi.doMock('../../src/lib/ssrf-guard.js', () => ({
      checkUrl: (raw: string) => ({ ok: true, url: new URL(raw) })
    }))
    const Fastify = (await import('fastify')).default
    const { proxyRoutes } = await import('../../src/routes/proxy.js')
    const { registerErrorHandlers } = await import('../../src/lib/errors.js')
    app = Fastify()
    registerErrorHandlers(app)
    await app.register(proxyRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.doUnmock('../../src/lib/ssrf-guard.js')
    vi.resetModules()
  })

  it('rewrites every referenced URI to flow back through /api/proxy', async () => {
    const target = `${originBase}/live/index.m3u8`
    const res = await app.inject({
      method: 'GET',
      url: `/api/proxy?url=${encodeURIComponent(target)}`
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('mpegurl')
    const body = res.payload

    // Tags are preserved.
    expect(body).toContain('#EXTM3U')
    expect(body).toContain('#EXT-X-ENDLIST')

    // Segment URIs are resolved to absolute and routed through the proxy.
    expect(body).toContain(
      `/api/proxy?url=${encodeURIComponent(`${originBase}/live/segment0.ts`)}`
    )
    expect(body).toContain(
      `/api/proxy?url=${encodeURIComponent(`${originBase}/live/sub/segment1.ts`)}`
    )

    // EXT-X-KEY and EXT-X-MAP URI="..." attributes are rewritten too.
    expect(body).toContain(
      `URI="/api/proxy?url=${encodeURIComponent(`${originBase}/live/enc.key`)}"`
    )
    expect(body).toContain(
      `URI="/api/proxy?url=${encodeURIComponent(`${originBase}/live/init.mp4`)}"`
    )

    // No raw relative URIs leak through.
    expect(body).not.toContain('\nsegment0.ts')
  })

  it('streams binary segments straight through', async () => {
    const target = `${originBase}/live/segment0.ts`
    const res = await app.inject({
      method: 'GET',
      url: `/api/proxy?url=${encodeURIComponent(target)}`
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('video/mp2t')
    expect(res.rawPayload[0]).toBe(0x47) // MPEG-TS sync byte, untouched
  })
})

describe('GET /api/proxy — SSRF guard (real guard, no mock)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'test'
    const Fastify = (await import('fastify')).default
    const { proxyRoutes } = await import('../../src/routes/proxy.js')
    const { registerErrorHandlers } = await import('../../src/lib/errors.js')
    app = Fastify()
    registerErrorHandlers(app)
    await app.register(proxyRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.resetModules()
  })

  it.each([
    ['loopback', 'http://127.0.0.1/secret.m3u8'],
    ['localhost', 'http://localhost/secret.m3u8'],
    ['private 192.168', 'http://192.168.1.5/x.m3u8'],
    ['private 10.x', 'http://10.0.0.1/x.m3u8'],
    ['link-local', 'http://169.254.1.1/x.m3u8'],
    ['internal tld', 'http://service.internal/x.m3u8']
  ])('rejects %s with a 400', async (_label, url) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/proxy?url=${encodeURIComponent(url)}`
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('BAD_REQUEST')
  })

  it('400s on a non-http(s) or malformed url', async () => {
    const file = await app.inject({
      method: 'GET',
      url: `/api/proxy?url=${encodeURIComponent('file:///etc/passwd')}`
    })
    expect(file.statusCode).toBe(400)

    const bad = await app.inject({ method: 'GET', url: '/api/proxy?url=not-a-url' })
    expect(bad.statusCode).toBe(400)
  })
})

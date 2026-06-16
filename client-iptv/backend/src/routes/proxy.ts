import { Readable } from 'node:stream'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { errors } from '../lib/errors.js'
import { checkUrl } from '../lib/ssrf-guard.js'
import { looksLikeManifest, rewriteManifest } from '../lib/hls-rewrite.js'
import { proxyQuerySchema } from '../schemas/proxy.query.js'

/**
 * Stream proxy (BE-12 / issue #22).
 *
 * `GET /api/proxy?url=<encoded>&ua=<opt>&referrer=<opt>`
 *
 * Relays the upstream HLS manifest/segments to the browser:
 *   - injects `User-Agent` / `Referer` from the passthrough params;
 *   - sets permissive CORS headers so hls.js can consume the response;
 *   - rewrites `.m3u8` manifests so every referenced URI flows back through the
 *     proxy (relative URIs are resolved to absolute first);
 *   - pipes binary segment bodies without buffering and forwards `Range`;
 *   - validates the target with the SSRF guard and times out slow origins.
 */

const PROXY_PATH = '/api/proxy'
const UPSTREAM_TIMEOUT_MS = 15000

/** Apply permissive CORS headers for media consumption. */
function setCorsHeaders(reply: FastifyReply): void {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Range, Content-Type')
  reply.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
}

/** Build the upstream request headers (passthrough UA/referrer + Range). */
function buildUpstreamHeaders(
  request: FastifyRequest,
  ua?: string,
  referrer?: string
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (ua) headers['User-Agent'] = ua
  if (referrer) headers.Referer = referrer
  const range = request.headers.range
  if (typeof range === 'string') headers.Range = range
  return headers
}

/** Forward a safe subset of upstream response headers to the client. */
function forwardResponseHeaders(reply: FastifyReply, upstream: Response): void {
  const passthrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'last-modified',
    'etag'
  ]
  for (const name of passthrough) {
    const value = upstream.headers.get(name)
    if (value !== null) reply.header(name, value)
  }
}

export async function proxyRoutes(app: FastifyInstance): Promise<void> {
  // Preflight for cross-origin players.
  app.options(PROXY_PATH, async (_request, reply) => {
    setCorsHeaders(reply)
    reply.status(204).send()
  })

  app.get(PROXY_PATH, async (request, reply) => {
    const { url, ua, referrer } = proxyQuerySchema.parse(request.query)

    const guard = checkUrl(url)
    if (!guard.ok || !guard.url) {
      throw errors.badRequest(`Refused to proxy URL: ${guard.reason ?? 'invalid URL'}`)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    let upstream: Response
    try {
      upstream = await fetch(guard.url.toString(), {
        method: 'GET',
        headers: buildUpstreamHeaders(request, ua, referrer),
        redirect: 'follow',
        signal: controller.signal
      })
    } catch (error) {
      clearTimeout(timer)
      const aborted = error instanceof Error && error.name === 'AbortError'
      throw errors.serviceUnavailable(
        aborted ? 'Upstream stream timed out' : 'Upstream stream is unreachable'
      )
    }

    setCorsHeaders(reply)

    const contentType = upstream.headers.get('content-type')

    // Manifests are small text bodies we must rewrite — buffer + transform.
    if (looksLikeManifest(contentType, guard.url.toString())) {
      try {
        const body = await upstream.text()
        clearTimeout(timer)
        const rewritten = rewriteManifest(body, {
          manifestUrl: guard.url.toString(),
          proxyBase: PROXY_PATH,
          userAgent: ua,
          referrer
        })
        reply
          .status(upstream.ok ? 200 : upstream.status)
          .header('content-type', contentType ?? 'application/vnd.apple.mpegurl')
          .header('cache-control', 'no-cache')
        return reply.send(rewritten)
      } catch {
        clearTimeout(timer)
        throw errors.serviceUnavailable('Failed to read upstream manifest')
      }
    }

    // Binary (segments/keys): stream straight through, forwarding status/headers.
    forwardResponseHeaders(reply, upstream)
    reply.status(upstream.status)

    if (!upstream.body) {
      clearTimeout(timer)
      return reply.send()
    }

    const nodeStream = Readable.fromWeb(upstream.body as unknown as WebReadableStream<Uint8Array>)
    // Release the timeout once the stream ends/errors so it isn't leaked.
    nodeStream.on('close', () => clearTimeout(timer))
    nodeStream.on('error', () => clearTimeout(timer))
    return reply.send(nodeStream)
  })
}

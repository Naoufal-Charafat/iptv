import { checkUrl } from './ssrf-guard.js'
import type { StreamStatus, StreamStatusState } from '../types/api.js'

/**
 * Stream availability checker (BE-14 / issue #24).
 *
 * Performs a lightweight check against a stream manifest URL and classifies the
 * outcome as online/offline/timeout/geoblocked. Results are cached in memory
 * with a TTL so repeated checks of the same URL don't hammer the origin. URLs
 * are validated with the SSRF guard before any request is made.
 *
 * No exception escapes `checkStream`: network failures are mapped to a status.
 */

export interface CheckOptions {
  userAgent?: string
  referrer?: string
  /** Per-request timeout in ms. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 6000
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CONCURRENCY = 6

interface CacheEntry {
  value: StreamStatus
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/** Clear the in-memory status cache (used by tests). */
export function clearStreamStatusCache(): void {
  cache.clear()
}

function getCached(url: string): StreamStatus | null {
  const entry = cache.get(url)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(url)
    return null
  }
  return entry.value
}

function setCached(url: string, value: StreamStatus): void {
  cache.set(url, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

function classify(httpStatus: number): StreamStatusState {
  if (httpStatus >= 200 && httpStatus < 400) return 'online'
  // 403/451 commonly indicate geo/licensing blocks.
  if (httpStatus === 403 || httpStatus === 451) return 'geoblocked'
  return 'offline'
}

/**
 * Check a single stream URL. Returns a cached result when available within the
 * TTL. Never throws.
 */
export async function checkStream(
  rawUrl: string,
  options: CheckOptions = {}
): Promise<StreamStatus> {
  const cached = getCached(rawUrl)
  if (cached) return cached

  const guard = checkUrl(rawUrl)
  if (!guard.ok || !guard.url) {
    const result: StreamStatus = {
      url: rawUrl,
      status: 'offline',
      httpStatus: null,
      checkedAt: new Date().toISOString()
    }
    setCached(rawUrl, result)
    return result
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {}
  if (options.userAgent) headers['User-Agent'] = options.userAgent
  if (options.referrer) headers.Referer = options.referrer

  let result: StreamStatus
  try {
    // Many HLS origins reject HEAD; use a GET and abort once headers arrive.
    const response = await fetch(guard.url.toString(), {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal
    })
    // We only need the status line / headers; release the body immediately.
    try {
      await response.body?.cancel()
    } catch {
      // ignore body-cancel failures
    }
    result = {
      url: rawUrl,
      status: classify(response.status),
      httpStatus: response.status,
      checkedAt: new Date().toISOString()
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    result = {
      url: rawUrl,
      status: aborted ? 'timeout' : 'offline',
      httpStatus: null,
      checkedAt: new Date().toISOString()
    }
  } finally {
    clearTimeout(timer)
  }

  setCached(rawUrl, result)
  return result
}

/**
 * Check many URLs with a bounded concurrency. Order of the returned array
 * matches the input. Never throws.
 */
export async function checkStreams(
  urls: string[],
  options: CheckOptions & { concurrency?: number } = {}
): Promise<StreamStatus[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, 16))
  const results = new Array<StreamStatus>(urls.length)
  let cursor = 0

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++
      if (index >= urls.length) return
      results[index] = await checkStream(urls[index] as string, options)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker())
  await Promise.all(workers)
  return results
}

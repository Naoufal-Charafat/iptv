import { delay, http, HttpResponse } from 'msw'

import type { ApiError, ChannelSummary, Dimension, Paginated } from '@client-iptv/shared'
import { DIMENSIONS } from '@client-iptv/shared'
import { channelSummaries, channels, detailFor, streamsFor } from './fixtures/channels'
import { dimensionItems, dimensionsMeta } from './fixtures/dimensions'
import { epgFor } from './fixtures/epg'
import { homeContent, trending } from './fixtures/home'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const url = (path: string) => `${BASE}${path}`

const DEFAULT_LIMIT = 24

function apiError(status: number, code: string, message: string) {
  const body: ApiError = { status, code, message }
  return HttpResponse.json(body, { status })
}

/**
 * Cursor pagination: the cursor is simply the next offset encoded as a
 * string. Returns the page plus the cursor for the following page.
 */
function paginate<T>(items: T[], cursor: string | null, limit: number): Paginated<T> {
  const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0
  const slice = items.slice(offset, offset + limit)
  const nextOffset = offset + limit
  return {
    data: slice,
    nextCursor: nextOffset < items.length ? String(nextOffset) : null,
    total: items.length
  }
}

/** Shared latency + error-injection. `?error=500|404` / `?delay=ms`. */
async function applyScenario(request: Request): Promise<Response | null> {
  const search = new URL(request.url).searchParams
  const ms = Number.parseInt(search.get('delay') ?? '', 10)
  await delay(Number.isFinite(ms) ? ms : 150)

  const error = search.get('error')
  if (error === '500') return apiError(500, 'INTERNAL_ERROR', 'Simulated server error')
  if (error === '404') return apiError(404, 'NOT_FOUND', 'Simulated not found')
  return null
}

function filterChannels(search: URLSearchParams): ChannelSummary[] {
  const q = search.get('q')?.toLowerCase().trim()
  const country = search.get('country')
  const category = search.get('category')

  return channelSummaries.filter(c => {
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (country && c.country !== country) return false
    if (category && !c.categories.includes(category)) return false
    return true
  })
}

export const handlers = [
  // Home content
  http.get(url('/home'), async ({ request }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    return HttpResponse.json(homeContent)
  }),

  // Trending
  http.get(url('/trending'), async ({ request }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    return HttpResponse.json(trending)
  }),

  // Dimensions metadata
  http.get(url('/dimensions'), async ({ request }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    return HttpResponse.json(dimensionsMeta)
  }),

  // Dimension items
  http.get(url('/dimensions/:dimension'), async ({ request, params }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    const dimension = params.dimension as Dimension
    if (!DIMENSIONS.includes(dimension)) {
      return apiError(404, 'NOT_FOUND', `Unknown dimension: ${String(params.dimension)}`)
    }
    return HttpResponse.json(dimensionItems(dimension))
  }),

  // Channel list (filtered + cursor-paginated)
  http.get(url('/channels'), async ({ request }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    const search = new URL(request.url).searchParams
    const limit = Number.parseInt(search.get('limit') ?? '', 10) || DEFAULT_LIMIT
    const filtered = filterChannels(search)
    return HttpResponse.json(paginate(filtered, search.get('cursor'), limit))
  }),

  // Search (alias of channel list, requires q)
  http.get(url('/search'), async ({ request }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    const search = new URL(request.url).searchParams
    const limit = Number.parseInt(search.get('limit') ?? '', 10) || DEFAULT_LIMIT
    const filtered = filterChannels(search)
    return HttpResponse.json(paginate(filtered, search.get('cursor'), limit))
  }),

  // Channel streams
  http.get(url('/channels/:id/streams'), async ({ request, params }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    const id = String(params.id)
    if (!channels.some(c => c.id === id)) {
      return apiError(404, 'NOT_FOUND', `Channel not found: ${id}`)
    }
    return HttpResponse.json(streamsFor(id))
  }),

  // Channel EPG
  http.get(url('/channels/:id/epg'), async ({ request, params }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    const id = String(params.id)
    if (!channels.some(c => c.id === id)) {
      return apiError(404, 'NOT_FOUND', `Channel not found: ${id}`)
    }
    return HttpResponse.json(epgFor(id))
  }),

  // Channel detail
  http.get(url('/channels/:id'), async ({ request, params }) => {
    const scenario = await applyScenario(request)
    if (scenario) return scenario
    const detail = detailFor(String(params.id))
    if (!detail) {
      return apiError(404, 'NOT_FOUND', `Channel not found: ${String(params.id)}`)
    }
    return HttpResponse.json(detail)
  })
]

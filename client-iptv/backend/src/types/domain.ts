/**
 * Domain DTOs returned by the repositories (BE-07 / issue #17).
 *
 * These are the backend-INTERNAL data-layer shapes (DB rows, offset/`page`
 * pagination, repository filters). They are intentionally distinct from the
 * over-the-wire API contract in `@client-iptv/shared` (FND-01 / issue #5):
 * the route serializers map these domain DTOs to the shared contract types
 * (e.g. this `Paginated<{items,total,page,pageSize}>` -> the contract's
 * cursor-based `Paginated<{data,nextCursor}>`). Keep them backend-local.
 */

/** A channel as exposed by the API (JSON list columns parsed to arrays). */
export interface ChannelDTO {
  id: string
  name: string
  altNames: string[]
  network: string | null
  owners: string[]
  country: string | null
  countryName: string | null
  categories: string[]
  languages: string[]
  isNsfw: boolean
  isClosed: boolean
  launched: string | null
  closed: string | null
  replacedBy: string | null
  website: string | null
  /** URL of the in-use (or first available) logo, if any. */
  logoUrl: string | null
  /** Number of playable streams available for the channel. */
  streamCount: number
  /** Best available stream quality for the channel, if known. */
  bestQuality: string | null
}

/** A playable stream for a channel. */
export interface StreamDTO {
  id: number
  channel: string | null
  feed: string | null
  title: string | null
  url: string
  referrer: string | null
  userAgent: string | null
  quality: string | null
  label: string | null
}

/** A channel feed (sub-channel / variant). */
export interface FeedDTO {
  channel: string
  id: string
  name: string | null
  altNames: string[]
  isMain: boolean
  broadcastArea: string[]
  timezones: string[]
  languages: string[]
  format: string | null
}

/** A channel logo. */
export interface LogoDTO {
  id: number
  channel: string | null
  feed: string | null
  inUse: boolean
  tags: string[]
  width: number | null
  height: number | null
  format: string | null
  url: string
}

/** An EPG guide entry for a channel. */
export interface GuideDTO {
  id: number
  channel: string | null
  feed: string | null
  site: string | null
  siteId: string | null
  siteName: string | null
  lang: string | null
  sources: string[]
}

/** The eight navigable dimensions. */
export type DimensionName =
  | 'categories'
  | 'cities'
  | 'countries'
  | 'languages'
  | 'raw'
  | 'regions'
  | 'sources'
  | 'subdivisions'

/** A single entry in a dimension catalogue, with its channel count. */
export interface DimensionItemDTO {
  /** Stable code/id of the dimension entry (e.g. country code, category id). */
  code: string
  /** Display name. */
  name: string
  /** Number of (non-blocked) channels associated with this entry. */
  channelCount: number
  /** Optional extra display field (e.g. country flag). */
  meta?: Record<string, unknown>
}

/** Filters accepted by `listChannels`. */
export interface ChannelFilters {
  country?: string
  category?: string
  language?: string
  /** Region code: matches channels whose country belongs to the region. */
  region?: string
  /** Free-text name filter (LIKE-based; full-text search uses the search repo). */
  q?: string
  /** Include channels marked closed/replaced (default: false). */
  includeClosed?: boolean
  /** Include NSFW channels (default: false). */
  includeNsfw?: boolean
  /** Only channels with at least one playable stream (applied in SQL). */
  hasStreams?: boolean
}

export type ChannelSortField = 'name' | 'country' | 'streamCount'
export interface ChannelSort {
  field: ChannelSortField
  direction: 'asc' | 'desc'
}

export interface Pagination {
  /** 1-based page number. */
  page: number
  /** Items per page. */
  pageSize: number
}

/** A paginated result envelope. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

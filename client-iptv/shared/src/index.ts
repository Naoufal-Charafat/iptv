/**
 * @client-iptv/shared — Canonical API contract (FND-01 / issue #5).
 * ---------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for the data exchanged between the frontend and the
 * backend (and the MSW mocks). Entity shapes mirror the iptv-org datasets
 * (channels, streams, feeds, logos and the 8 navigation dimensions); the
 * envelope types describe the REST surface the backend exposes.
 *
 * Consumed as a workspace package:
 *   - backend  → resolves the built package from node_modules (NodeNext).
 *   - frontend → resolves this source file via the `@client-iptv/shared` alias
 *                (tsconfig paths + Vite alias).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** ISO-3166-1 alpha-2 country code, e.g. "DO", "US". */
export type CountryCode = string
/** ISO-639-3 language code, e.g. "spa", "eng". */
export type LanguageCode = string
/** Stream quality label, e.g. "720p", "1080p", "480i". */
export type Quality = string

/** The 8 navigation dimensions supported by the explorer. */
export type Dimension =
  | 'categories'
  | 'cities'
  | 'countries'
  | 'languages'
  | 'raw'
  | 'regions'
  | 'sources'
  | 'subdivisions'

export const DIMENSIONS: readonly Dimension[] = [
  'categories',
  'cities',
  'countries',
  'languages',
  'raw',
  'regions',
  'sources',
  'subdivisions'
] as const

// ---------------------------------------------------------------------------
// Core entities (mirror iptv-org JSON)
// ---------------------------------------------------------------------------

export interface Channel {
  id: string
  name: string
  alt_names: string[]
  network: string | null
  owners: string[]
  country: CountryCode
  categories: string[]
  is_nsfw: boolean
  launched: string | null
  closed: string | null
  replaced_by: string | null
  website: string | null
}

export interface Feed {
  channel: string
  id: string
  name: string
  alt_names: string[]
  is_main: boolean
  broadcast_area: string[]
  timezones: string[]
  languages: LanguageCode[]
  format: string | null
}

export interface Stream {
  channel: string | null
  feed: string | null
  title: string
  url: string
  quality: Quality | null
  label: string | null
  user_agent: string | null
  referrer: string | null
}

export interface Logo {
  channel: string
  feed: string | null
  in_use: boolean
  tags: string[]
  width: number
  height: number
  format: string
  url: string
}

// ---------------------------------------------------------------------------
// Dimension entities
// ---------------------------------------------------------------------------

export interface Category {
  id: string
  name: string
  description?: string
}

export interface Country {
  name: string
  code: CountryCode
  languages: LanguageCode[]
  flag: string
}

export interface Language {
  code: LanguageCode
  name: string
}

export interface Region {
  code: string
  name: string
  countries: CountryCode[]
}

export interface Subdivision {
  country: CountryCode
  code: string
  name: string
  parent: string | null
}

export interface City {
  country: CountryCode
  subdivision: string | null
  code: string
  name: string
  wikidata_id: string | null
}

export interface Source {
  id: string
  name: string
}

/**
 * Generic, UI-friendly representation of a single dimension entry. The
 * `/dimensions/:dimension` endpoint normalizes every dimension into this
 * shape so the explorer can render any of them with one component.
 */
export interface DimensionItem {
  /** Stable identifier within the dimension (code/id). */
  id: string
  /** Human-readable label. */
  name: string
  /** Optional secondary text (description, country, etc.). */
  subtitle?: string
  /** Emoji flag or icon glyph when available. */
  glyph?: string
  /** Number of channels under this entry (when known). */
  channelCount?: number
}

// ---------------------------------------------------------------------------
// Composite / view models
// ---------------------------------------------------------------------------

/** A channel enriched with its main logo + feeds for list/detail views. */
export interface ChannelSummary {
  id: string
  name: string
  country: CountryCode
  categories: string[]
  is_nsfw: boolean
  logo: string | null
  /** Best available stream quality, when known. */
  quality: Quality | null
  /** True when at least one playable stream exists. */
  hasStream: boolean
}

export interface ChannelDetail extends Channel {
  logo: string | null
  feeds: Feed[]
  logos: Logo[]
  streamCount: number
}

// ---------------------------------------------------------------------------
// EPG (guides)
// ---------------------------------------------------------------------------

export interface EpgProgram {
  channel: string
  title: string
  /** ISO-8601 start time. */
  start: string
  /** ISO-8601 stop time. */
  stop: string
  description?: string
  category?: string
}

export interface EpgGuide {
  channel: string
  feed: string | null
  site: string
  site_id: string
  site_name: string
  lang: string
  programs: EpgProgram[]
}

// ---------------------------------------------------------------------------
// Home content
// ---------------------------------------------------------------------------

export interface HeroItem {
  channelId: string
  title: string
  subtitle: string
  description: string
  backdrop: string
  logo: string | null
  badge?: string
}

export interface Carousel {
  id: string
  title: string
  items: ChannelSummary[]
}

export interface HomeContent {
  hero: HeroItem
  carousels: Carousel[]
}

// ---------------------------------------------------------------------------
// Query / filter params
// ---------------------------------------------------------------------------

export interface ChannelListParams {
  q?: string
  country?: CountryCode
  category?: string
  language?: LanguageCode
  region?: string
  /** Opaque pagination cursor returned by the previous page. */
  cursor?: string
  limit?: number
}

export interface SearchParams {
  q: string
  cursor?: string
  limit?: number
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

/** Cursor-based pagination envelope used for infinite lists. */
export interface Paginated<T> {
  data: T[]
  /** Cursor for the next page, or null when there are no more results. */
  nextCursor: string | null
  /** Total matching items, when the backend can compute it cheaply. */
  total?: number
}

/** Normalized API error shape (HTTP errors are mapped to this). */
export interface ApiError {
  /** Machine-readable error code, e.g. "NOT_FOUND". */
  code: string
  /** Human-readable message. */
  message: string
  /** HTTP status code. */
  status: number
  /** Optional field-level details. */
  details?: Record<string, unknown>
}

export interface TrendingItem {
  id: string
  label: string
  query: string
}

// ---------------------------------------------------------------------------
// Stream status (BE-14 / issue #24)
// ---------------------------------------------------------------------------

export type StreamStatusState = 'online' | 'offline' | 'timeout' | 'geoblocked'

export interface StreamStatus {
  url: string
  status: StreamStatusState
  /** Upstream HTTP status code, when a response was received. */
  httpStatus: number | null
  /** ISO-8601 timestamp of when the check was performed. */
  checkedAt: string
}

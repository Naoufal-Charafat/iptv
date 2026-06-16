import type {
  ChannelDTO,
  DimensionItemDTO,
  FeedDTO,
  GuideDTO,
  LogoDTO,
  StreamDTO
} from '../types/domain.js'

/**
 * Row -> DTO mappers (BE-07 / issue #17).
 *
 * Centralizes parsing of JSON list columns (alt_names, owners, categories, ...)
 * and the row->DTO shape used by the repositories. Keeping the mapping here
 * means no SQL or column-name knowledge leaks beyond `src/db/`.
 */

/** Parse a JSON-array text column into a string[] (defensive against bad data). */
export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1'
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function toNumberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

/** Raw shape of a `channels` row joined with logo/stream aggregates. */
export interface ChannelRow {
  id: string
  name: string
  alt_names: string
  network: string | null
  owners: string
  country: string | null
  country_name: string | null
  categories: string
  is_nsfw: number
  is_closed: number
  launched: string | null
  closed: string | null
  replaced_by: string | null
  website: string | null
  languages?: string | null
  logo_url?: string | null
  stream_count?: number | null
  best_quality?: string | null
}

export function mapChannel(row: ChannelRow): ChannelDTO {
  return {
    id: row.id,
    name: row.name,
    altNames: parseJsonArray(row.alt_names),
    network: row.network ?? null,
    owners: parseJsonArray(row.owners),
    country: row.country ?? null,
    countryName: row.country_name ?? null,
    categories: parseJsonArray(row.categories),
    languages: parseJsonArray(row.languages ?? '[]'),
    isNsfw: toBool(row.is_nsfw),
    isClosed: toBool(row.is_closed),
    launched: row.launched ?? null,
    closed: row.closed ?? null,
    replacedBy: row.replaced_by ?? null,
    website: row.website ?? null,
    logoUrl: row.logo_url ?? null,
    streamCount: Number(row.stream_count ?? 0),
    bestQuality: toStringOrNull(row.best_quality)
  }
}

export interface StreamRow {
  id: number
  channel: string | null
  feed: string | null
  title: string | null
  url: string
  referrer: string | null
  user_agent: string | null
  quality: string | null
  label: string | null
}

export function mapStream(row: StreamRow): StreamDTO {
  return {
    id: Number(row.id),
    channel: toStringOrNull(row.channel),
    feed: toStringOrNull(row.feed),
    title: toStringOrNull(row.title),
    url: row.url,
    referrer: toStringOrNull(row.referrer),
    userAgent: toStringOrNull(row.user_agent),
    quality: toStringOrNull(row.quality),
    label: toStringOrNull(row.label)
  }
}

export interface FeedRow {
  channel: string
  id: string
  name: string | null
  alt_names: string
  is_main: number
  broadcast_area: string
  languages: string
  timezones: string
  format: string | null
}

export function mapFeed(row: FeedRow): FeedDTO {
  return {
    channel: row.channel,
    id: row.id,
    name: toStringOrNull(row.name),
    altNames: parseJsonArray(row.alt_names),
    isMain: toBool(row.is_main),
    broadcastArea: parseJsonArray(row.broadcast_area),
    timezones: parseJsonArray(row.timezones),
    languages: parseJsonArray(row.languages),
    format: toStringOrNull(row.format)
  }
}

export interface LogoRow {
  id: number
  channel: string | null
  feed: string | null
  in_use: number
  tags: string
  width: number | null
  height: number | null
  format: string | null
  url: string
}

export function mapLogo(row: LogoRow): LogoDTO {
  return {
    id: Number(row.id),
    channel: toStringOrNull(row.channel),
    feed: toStringOrNull(row.feed),
    inUse: toBool(row.in_use),
    tags: parseJsonArray(row.tags),
    width: toNumberOrNull(row.width),
    height: toNumberOrNull(row.height),
    format: toStringOrNull(row.format),
    url: row.url
  }
}

export interface GuideRow {
  id: number
  channel: string | null
  feed: string | null
  site: string | null
  site_id: string | null
  site_name: string | null
  lang: string | null
  sources: string
}

export function mapGuide(row: GuideRow): GuideDTO {
  return {
    id: Number(row.id),
    channel: toStringOrNull(row.channel),
    feed: toStringOrNull(row.feed),
    site: toStringOrNull(row.site),
    siteId: toStringOrNull(row.site_id),
    siteName: toStringOrNull(row.site_name),
    lang: toStringOrNull(row.lang),
    sources: parseJsonArray(row.sources)
  }
}

export interface DimensionRow {
  code: string
  name: string
  channel_count: number
  flag?: string | null
  country?: string | null
}

export function mapDimensionItem(row: DimensionRow): DimensionItemDTO {
  const item: DimensionItemDTO = {
    code: row.code,
    name: row.name,
    channelCount: Number(row.channel_count ?? 0)
  }
  const meta: Record<string, unknown> = {}
  if (row.flag) meta.flag = row.flag
  if (row.country) meta.country = row.country
  if (Object.keys(meta).length > 0) item.meta = meta
  return item
}

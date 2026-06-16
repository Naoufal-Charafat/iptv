/**
 * Response serializers (BE-08..BE-14).
 *
 * Convert the repositories' internal DTOs (`src/types/domain.ts`, camelCase,
 * data-layer oriented) into the public API contract shapes
 * (`src/types/api.ts`, the `@client-iptv/shared` mirror the frontend consumes).
 * Keeping this mapping in one place means routes stay thin and the wire format
 * is guaranteed to match the contract.
 */

import type {
  ChannelDTO,
  DimensionItemDTO,
  FeedDTO,
  GuideDTO,
  LogoDTO,
  StreamDTO
} from '../types/domain.js'
import type {
  ChannelDetail,
  ChannelSummary,
  Dimension,
  DimensionItem,
  EpgGuide,
  Feed,
  Logo,
  Paginated,
  Stream
} from '../types/api.js'

/** Map a channel DTO to the list/card `ChannelSummary` contract shape. */
export function toChannelSummary(dto: ChannelDTO): ChannelSummary {
  return {
    id: dto.id,
    name: dto.name,
    country: dto.country ?? '',
    categories: dto.categories,
    is_nsfw: dto.isNsfw,
    logo: dto.logoUrl,
    quality: dto.bestQuality,
    hasStream: dto.streamCount > 0
  }
}

/** Map a stream DTO to the contract `Stream` shape (snake_case fields). */
export function toStream(dto: StreamDTO): Stream {
  return {
    channel: dto.channel,
    feed: dto.feed,
    title: dto.title ?? '',
    url: dto.url,
    quality: dto.quality,
    label: dto.label,
    user_agent: dto.userAgent,
    referrer: dto.referrer
  }
}

/** Map a logo DTO to the contract `Logo` shape. */
export function toLogo(dto: LogoDTO): Logo {
  return {
    channel: dto.channel ?? '',
    feed: dto.feed,
    in_use: dto.inUse,
    tags: dto.tags,
    width: dto.width ?? 0,
    height: dto.height ?? 0,
    format: dto.format ?? '',
    url: dto.url
  }
}

/** Map a feed DTO to the contract `Feed` shape. */
export function toFeed(dto: FeedDTO): Feed {
  return {
    channel: dto.channel,
    id: dto.id,
    name: dto.name ?? '',
    alt_names: dto.altNames,
    is_main: dto.isMain,
    broadcast_area: dto.broadcastArea,
    timezones: dto.timezones,
    languages: dto.languages,
    format: dto.format
  }
}

/** Assemble the full `ChannelDetail` from its component DTOs. */
export function toChannelDetail(
  channel: ChannelDTO,
  feeds: FeedDTO[],
  logos: LogoDTO[]
): ChannelDetail {
  return {
    id: channel.id,
    name: channel.name,
    alt_names: channel.altNames,
    network: channel.network,
    owners: channel.owners,
    country: channel.country ?? '',
    categories: channel.categories,
    is_nsfw: channel.isNsfw,
    launched: channel.launched,
    closed: channel.closed,
    replaced_by: channel.replacedBy,
    website: channel.website,
    logo: channel.logoUrl,
    feeds: feeds.map(toFeed),
    logos: logos.map(toLogo),
    streamCount: channel.streamCount
  }
}

/**
 * Map a dimension-item DTO to the contract `DimensionItem`. Promotes the
 * known `meta` fields (`flag` -> glyph, `country` -> subtitle) into the
 * flat UI shape the explorer renders.
 */
export function toDimensionItem(dto: DimensionItemDTO): DimensionItem {
  const item: DimensionItem = {
    id: dto.code,
    name: dto.name,
    channelCount: dto.channelCount
  }
  const flag = dto.meta?.flag
  if (typeof flag === 'string' && flag.length > 0) item.glyph = flag
  const country = dto.meta?.country
  if (typeof country === 'string' && country.length > 0) item.subtitle = country
  return item
}

/**
 * Map a channel's guide DTOs + a feed-derived program window into the contract
 * `EpgGuide`. The dataset only provides guide *sources* (no program schedule),
 * so `programs` is left empty; the shape still matches the contract so the
 * frontend renders an "EPG unavailable" state gracefully.
 */
export function toEpgGuide(channelId: string, guides: GuideDTO[]): EpgGuide {
  const g = guides[0]
  return {
    channel: channelId,
    feed: g?.feed ?? null,
    site: g?.site ?? '',
    site_id: g?.siteId ?? '',
    site_name: g?.siteName ?? '',
    lang: g?.lang ?? '',
    programs: []
  }
}

/**
 * Build a cursor-paginated envelope from an offset-based slice.
 *
 * The cursor is the next offset encoded as a string (matching the frontend MSW
 * mocks). `nextCursor` is null when the current slice is the last page.
 */
export function toCursorPage<T>(
  items: T[],
  offset: number,
  limit: number,
  total: number
): Paginated<T> {
  const nextOffset = offset + items.length
  return {
    data: items,
    nextCursor: nextOffset < total ? String(nextOffset) : null,
    total
  }
}

/** Decode a cursor (numeric offset string) into a non-negative integer. */
export function parseCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const n = Number.parseInt(cursor, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Validate that a string is one of the 8 navigation dimensions. */
export function isDimension(value: string): value is Dimension {
  return (
    value === 'categories' ||
    value === 'cities' ||
    value === 'countries' ||
    value === 'languages' ||
    value === 'raw' ||
    value === 'regions' ||
    value === 'sources' ||
    value === 'subdivisions'
  )
}

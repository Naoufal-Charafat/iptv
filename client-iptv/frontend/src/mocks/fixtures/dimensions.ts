import type { Dimension, DimensionItem } from '@client-iptv/shared'

/** Metadata for the 8 navigation dimensions (drives the Explore grid). */
export const dimensionsMeta: DimensionItem[] = [
  { id: 'categories', name: 'Categories', subtitle: 'Movies, News, Sports...', glyph: 'category' },
  { id: 'cities', name: 'Cities', subtitle: 'Local channels by city', glyph: 'location_city' },
  { id: 'countries', name: 'Countries', subtitle: 'Global broadcasts', glyph: 'public' },
  { id: 'languages', name: 'Languages', subtitle: 'Filter by audio', glyph: 'translate' },
  { id: 'regions', name: 'Regions', subtitle: 'Continental groupings', glyph: 'map' },
  { id: 'sources', name: 'Sources', subtitle: 'Network providers', glyph: 'router' },
  { id: 'subdivisions', name: 'Subdivisions', subtitle: 'States & Provinces', glyph: 'grid_view' },
  { id: 'raw', name: 'Raw', subtitle: 'Direct stream links', glyph: 'data_object' }
]

const itemsByDimension: Record<Dimension, DimensionItem[]> = {
  categories: [
    { id: 'general', name: 'General', channelCount: 1240 },
    { id: 'news', name: 'News', channelCount: 612 },
    { id: 'movies', name: 'Movies', channelCount: 388 },
    { id: 'sports', name: 'Sports', channelCount: 421 },
    { id: 'entertainment', name: 'Entertainment', channelCount: 530 },
    { id: 'kids', name: 'Kids', channelCount: 277 },
    { id: 'music', name: 'Music', channelCount: 198 },
    { id: 'documentary', name: 'Documentary', channelCount: 143 }
  ],
  countries: [
    { id: 'US', name: 'United States', glyph: '🇺🇸', channelCount: 2890 },
    { id: 'GB', name: 'United Kingdom', glyph: '🇬🇧', channelCount: 940 },
    { id: 'ES', name: 'Spain', glyph: '🇪🇸', channelCount: 612 },
    { id: 'MX', name: 'Mexico', glyph: '🇲🇽', channelCount: 488 },
    { id: 'DO', name: 'Dominican Republic', glyph: '🇩🇴', channelCount: 77 },
    { id: 'FR', name: 'France', glyph: '🇫🇷', channelCount: 533 },
    { id: 'DE', name: 'Germany', glyph: '🇩🇪', channelCount: 470 },
    { id: 'BR', name: 'Brazil', glyph: '🇧🇷', channelCount: 401 }
  ],
  languages: [
    { id: 'eng', name: 'English', channelCount: 6120 },
    { id: 'spa', name: 'Spanish', channelCount: 2810 },
    { id: 'fra', name: 'French', channelCount: 1190 },
    { id: 'deu', name: 'German', channelCount: 980 },
    { id: 'por', name: 'Portuguese', channelCount: 760 },
    { id: 'ara', name: 'Arabic', channelCount: 640 }
  ],
  regions: [
    { id: 'AFR', name: 'Africa', channelCount: 1320 },
    { id: 'AMER', name: 'Americas', channelCount: 5980 },
    { id: 'ASIA', name: 'Asia', channelCount: 4210 },
    { id: 'EUR', name: 'Europe', channelCount: 6440 },
    { id: 'OCE', name: 'Oceania', channelCount: 320 }
  ],
  cities: [
    { id: 'USNYC', name: 'New York', subtitle: 'United States', channelCount: 88 },
    { id: 'GBLON', name: 'London', subtitle: 'United Kingdom', channelCount: 102 },
    { id: 'ESMAD', name: 'Madrid', subtitle: 'Spain', channelCount: 64 },
    { id: 'MXMEX', name: 'Mexico City', subtitle: 'Mexico', channelCount: 71 }
  ],
  subdivisions: [
    { id: 'US-CA', name: 'California', subtitle: 'United States', channelCount: 210 },
    { id: 'US-NY', name: 'New York', subtitle: 'United States', channelCount: 188 },
    { id: 'ES-MD', name: 'Madrid', subtitle: 'Spain', channelCount: 64 },
    { id: 'GB-ENG', name: 'England', subtitle: 'United Kingdom', channelCount: 540 }
  ],
  sources: [
    { id: 'iptv-org', name: 'iptv-org', channelCount: 9800 },
    { id: 'samsung-tvplus', name: 'Samsung TV Plus', channelCount: 1100 },
    { id: 'pluto-tv', name: 'Pluto TV', channelCount: 820 },
    { id: 'plex', name: 'Plex', channelCount: 460 }
  ],
  raw: [
    {
      id: 'm3u8',
      name: 'HLS (.m3u8)',
      subtitle: 'Adaptive HTTP Live Streaming',
      channelCount: 14200
    },
    { id: 'mpd', name: 'DASH (.mpd)', subtitle: 'MPEG-DASH manifests', channelCount: 480 },
    { id: 'ts', name: 'MPEG-TS', subtitle: 'Direct transport streams', channelCount: 640 }
  ]
}

export function dimensionItems(dimension: Dimension): DimensionItem[] {
  return itemsByDimension[dimension]
}

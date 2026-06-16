import type {
  Channel,
  ChannelDetail,
  ChannelSummary,
  Feed,
  Logo,
  Stream
} from '@client-iptv/shared'

/**
 * A publicly reachable HLS test stream (Mux test asset). Used for the first
 * channel so the player screen has something it can actually play.
 */
export const DEMO_HLS_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

const NAMES = [
  'Global News Network',
  'Cine Premiere',
  'Sports Center HD',
  'Documentary World',
  'Kids Planet',
  'Music Box',
  'Nightly News',
  'Action Cinema',
  'Tech Today',
  'Nature Channel',
  'Comedy Central Live',
  'Retro Movies',
  'Travel & Living',
  'Cooking Network',
  'Market Finance',
  'Anime Stream',
  'Classic Rock TV',
  'Weather 24',
  'History Vault',
  'Drama Theater'
] as const

const COUNTRIES = ['US', 'GB', 'ES', 'MX', 'DO', 'FR', 'DE', 'BR'] as const
const CATEGORY_POOL = [
  'general',
  'news',
  'movies',
  'sports',
  'entertainment',
  'kids',
  'music',
  'documentary'
] as const
const QUALITIES = ['1080p', '720p', '480p', '480i', null] as const

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length] as T
}

const TOTAL = 120

/** Deterministically generated channel pool (stable across reloads). */
export const channels: Channel[] = Array.from({ length: TOTAL }, (_, i) => {
  const baseName = pick(NAMES, i)
  const name = i < NAMES.length ? baseName : `${baseName} ${Math.floor(i / NAMES.length) + 1}`
  const country = pick(COUNTRIES, i)
  return {
    id: `${name.replace(/[^a-zA-Z0-9]/g, '')}.${country.toLowerCase()}`,
    name,
    alt_names: [],
    network: i % 3 === 0 ? `${baseName} Network` : null,
    owners: [],
    country,
    categories: [pick(CATEGORY_POOL, i), pick(CATEGORY_POOL, i + 3)].filter(
      (c, idx, a) => a.indexOf(c) === idx
    ),
    is_nsfw: false,
    launched: null,
    closed: null,
    replaced_by: null,
    website: `https://example.com/${i}`
  }
})

function logoFor(channelId: string, i: number): Logo {
  return {
    channel: channelId,
    feed: null,
    in_use: true,
    tags: [],
    width: 320,
    height: 320,
    format: 'PNG',
    url: `https://picsum.photos/seed/${encodeURIComponent(channelId)}/320/320?i=${i}`
  }
}

function feedFor(channel: Channel): Feed {
  return {
    channel: channel.id,
    id: 'SD',
    name: 'SD',
    alt_names: [],
    is_main: true,
    broadcast_area: [`c/${channel.country}`],
    timezones: ['America/New_York'],
    languages: [channel.country === 'ES' || channel.country === 'MX' ? 'spa' : 'eng'],
    format: '1080p'
  }
}

export function streamsFor(channelId: string): Stream[] {
  const index = channels.findIndex(c => c.id === channelId)
  // First channel gets the real, playable demo stream.
  const url = index <= 0 ? DEMO_HLS_URL : `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`
  const quality = pick(QUALITIES, index < 0 ? 0 : index) ?? '720p'
  return [
    {
      channel: channelId,
      feed: 'SD',
      title: channels[index]?.name ?? channelId,
      url,
      quality,
      label: null,
      user_agent: null,
      referrer: null
    }
  ]
}

export function summaryFor(channel: Channel, i: number): ChannelSummary {
  return {
    id: channel.id,
    name: channel.name,
    country: channel.country,
    categories: channel.categories,
    is_nsfw: channel.is_nsfw,
    logo: logoFor(channel.id, i).url,
    quality: pick(QUALITIES, i) ?? '720p',
    hasStream: true
  }
}

export const channelSummaries: ChannelSummary[] = channels.map(summaryFor)

export function detailFor(channelId: string): ChannelDetail | null {
  const index = channels.findIndex(c => c.id === channelId)
  if (index < 0) return null
  const channel = channels[index] as Channel
  const logo = logoFor(channel.id, index)
  return {
    ...channel,
    logo: logo.url,
    feeds: [feedFor(channel)],
    logos: [logo],
    streamCount: streamsFor(channel.id).length
  }
}

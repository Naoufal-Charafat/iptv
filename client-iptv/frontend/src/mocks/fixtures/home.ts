import type { Carousel, HomeContent, TrendingItem } from '@client-iptv/shared'
import { channelSummaries, channels } from './channels'

export const trending: TrendingItem[] = [
  { id: 't1', label: 'Action Movies 2024', query: 'action' },
  { id: 't2', label: 'Live Sports UK', query: 'sports' },
  { id: 't3', label: 'Anime Subs', query: 'anime' },
  { id: 't4', label: 'US News Live', query: 'news' },
  { id: 't5', label: 'Documentary', query: 'documentary' }
]

function carousel(id: string, title: string, predicate: (i: number) => boolean): Carousel {
  return {
    id,
    title,
    items: channelSummaries.filter((_, i) => predicate(i)).slice(0, 12)
  }
}

export const homeContent: HomeContent = {
  hero: {
    channelId: channels[0]?.id ?? 'GlobalNewsNetwork.us',
    title: 'Global News Network',
    subtitle: 'LIVE NOW',
    description:
      'Breaking updates from around the world. In-depth analysis on international markets, geopolitics, and unfolding events happening live. Stay informed 24/7 with coverage.',
    backdrop: 'https://picsum.photos/seed/hero-news/1600/900',
    logo: channelSummaries[0]?.logo ?? null,
    badge: 'LIVE NOW'
  },
  carousels: [
    carousel('recommended', 'Recommended for You', i => i % 2 === 0),
    carousel('news', 'News Channels', i => i % 3 === 0),
    carousel('sports', 'Live Sports', i => i % 4 === 1),
    carousel('movies', 'Movies & Cinema', i => i % 3 === 1)
  ]
}

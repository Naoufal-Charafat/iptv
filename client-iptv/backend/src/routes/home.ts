import type { FastifyInstance } from 'fastify'
import { ChannelsRepository } from '../db/repositories/channels.repo.js'
import { toChannelSummary } from './serializers.js'
import type { Carousel, HomeContent, TrendingItem } from '../types/api.js'
import type { ChannelFilters } from '../types/domain.js'

/**
 * Home aggregation routes (consumed by the landing screen).
 *   - GET /api/home     -> hero + content carousels
 *   - GET /api/trending -> trending search chips
 *
 * The backend serves data from SQLite (not the generated .m3u playlists); these
 * endpoints assemble a `HomeContent` payload from the channel repository so the
 * Home screen has real shelves to render.
 */
export async function homeRoutes(app: FastifyInstance): Promise<void> {
  const channels = () => new ChannelsRepository()

  /** A content shelf of playable channels, sorted by stream availability. */
  function shelf(id: string, title: string, filters: ChannelFilters, size = 12): Carousel {
    const result = channels().listChannels(
      { ...filters, hasStreams: true, includeNsfw: false },
      { field: 'streamCount', direction: 'desc' },
      { page: 1, pageSize: size }
    )
    return { id, title, items: result.items.map(toChannelSummary) }
  }

  app.get('/api/home', async (): Promise<HomeContent> => {
    const recommended = shelf('recommended', 'Recomendados para ti', {}, 16)
    const hero = recommended.items.find(c => c.logo) ?? recommended.items[0]

    const carousels: Carousel[] = [
      recommended,
      shelf('news', 'Noticias en directo', { category: 'news' }),
      shelf('sports', 'Deportes', { category: 'sports' }),
      shelf('movies', 'Cine y películas', { category: 'movies' }),
      shelf('entertainment', 'Entretenimiento', { category: 'entertainment' }),
      shelf('music', 'Música', { category: 'music' })
    ].filter(c => c.items.length > 0)

    return {
      hero: {
        channelId: hero?.id ?? '',
        title: hero?.name ?? 'IPTV',
        subtitle: 'LIVE NOW',
        description:
          'Miles de canales en directo de todo el mundo: noticias, deportes, cine y mucho más, 24/7.',
        backdrop: hero ? `https://picsum.photos/seed/${encodeURIComponent(hero.id)}/1600/900` : '',
        logo: hero?.logo ?? null,
        badge: 'LIVE NOW'
      },
      carousels
    }
  })

  app.get('/api/trending', async (): Promise<TrendingItem[]> => {
    return [
      { id: 't1', label: 'Noticias en directo', query: 'news' },
      { id: 't2', label: 'Deportes', query: 'sport' },
      { id: 't3', label: 'Cine', query: 'cine' },
      { id: 't4', label: 'Música', query: 'music' },
      { id: 't5', label: 'Infantil', query: 'kids' },
      { id: 't6', label: 'Documentales', query: 'documental' }
    ]
  })
}

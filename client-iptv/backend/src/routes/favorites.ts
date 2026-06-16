import type { FastifyInstance } from 'fastify'
import { FavoritesRepository } from '../db/repositories/favorites.repo.js'
import { ChannelsRepository } from '../db/repositories/channels.repo.js'
import { errors } from '../lib/errors.js'
import {
  addFavoriteBodySchema,
  favoriteParamsSchema
} from '../schemas/favorites.schema.js'
import { toChannelSummary } from './serializers.js'
import type { ChannelSummary } from '../types/api.js'

/**
 * Favorites routes (BE-13 / issue #23).
 *
 *   - `GET    /api/favorites`            resolved favorite channels.
 *   - `GET    /api/favorites/ids`        just the favorited ids.
 *   - `POST   /api/favorites`            add (idempotent); 404 if channel unknown.
 *   - `DELETE /api/favorites/:channelId` remove (idempotent).
 *
 * Server-side favorites are stored in the local `favorites` table (the ETL
 * never clears it). This is complementary to the frontend's localStorage store
 * (FE-13).
 */
export async function favoritesRoutes(app: FastifyInstance): Promise<void> {
  const favRepo = () => new FavoritesRepository()
  const channelsRepo = () => new ChannelsRepository()

  app.get('/api/favorites', async (): Promise<ChannelSummary[]> => {
    return favRepo().listFavorites().map(toChannelSummary)
  })

  app.get('/api/favorites/ids', async (): Promise<string[]> => {
    return favRepo().listFavoriteIds()
  })

  app.post('/api/favorites', async (request, reply): Promise<{ channelId: string }> => {
    const { channelId } = addFavoriteBodySchema.parse(request.body)

    if (!channelsRepo().getChannelById(channelId)) {
      throw errors.notFound(`Channel not found: ${channelId}`)
    }

    const created = favRepo().addFavorite(channelId)
    reply.status(created ? 201 : 200)
    return { channelId }
  })

  app.delete('/api/favorites/:channelId', async (request): Promise<{ channelId: string }> => {
    const { channelId } = favoriteParamsSchema.parse(request.params)
    favRepo().removeFavorite(channelId) // idempotent: no error if absent
    return { channelId }
  })
}

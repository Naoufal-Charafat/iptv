import { z } from 'zod'

/**
 * Schemas for the favorites endpoints (BE-13 / issue #23).
 */

export const addFavoriteBodySchema = z.object({
  channelId: z.string().trim().min(1, 'channelId is required')
})

export type AddFavoriteBody = z.infer<typeof addFavoriteBodySchema>

export const favoriteParamsSchema = z.object({
  channelId: z.string().trim().min(1)
})

export type FavoriteParams = z.infer<typeof favoriteParamsSchema>

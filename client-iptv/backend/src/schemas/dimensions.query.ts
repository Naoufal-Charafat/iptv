import { z } from 'zod'
import { DIMENSIONS } from '../types/api.js'

/**
 * Schemas for the dimension catalogue endpoints (BE-09 / issue #19).
 */

export const dimensionParamsSchema = z.object({
  dimension: z.enum(DIMENSIONS as unknown as [string, ...string[]])
})

export type DimensionParams = z.infer<typeof dimensionParamsSchema>

/** Optional filters for subdivisions/cities catalogues. */
export const dimensionItemsQuerySchema = z.object({
  country: z.string().trim().min(1).optional(),
  subdivision: z.string().trim().min(1).optional()
})

export type DimensionItemsQuery = z.infer<typeof dimensionItemsQuerySchema>

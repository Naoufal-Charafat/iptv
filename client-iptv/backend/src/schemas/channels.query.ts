import { z } from 'zod'

/**
 * Query schema for `GET /api/channels` (BE-08 / issue #18).
 *
 * Supports filtering by the navigation dimensions plus two pagination styles:
 *   - cursor-based (`cursor` = opaque offset string) — the contract default
 *     used by the frontend's infinite lists;
 *   - page-based (`page` + `limit`) — accepted for the issue's acceptance
 *     criteria (`?page=1&limit=12`).
 * When both are given, `cursor` wins.
 */

const positiveInt = (def: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(def)

const trimmed = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform(v => (v === '' ? undefined : v))

export const channelListQuerySchema = z.object({
  q: trimmed,
  country: trimmed,
  category: trimmed,
  language: trimmed,
  region: trimmed,
  subdivision: trimmed,
  city: trimmed,
  source: trimmed,
  quality: trimmed,
  is_nsfw: z.coerce.boolean().default(false),
  has_streams: z.coerce.boolean().default(true),
  sort: z.enum(['name', 'country', 'streams']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  cursor: z.string().optional(),
  page: positiveInt(1, 1, 100000),
  limit: positiveInt(24, 1, 100)
})

export type ChannelListQuery = z.infer<typeof channelListQuerySchema>

export const channelIdParamsSchema = z.object({
  id: z.string().trim().min(1)
})

export type ChannelIdParams = z.infer<typeof channelIdParamsSchema>

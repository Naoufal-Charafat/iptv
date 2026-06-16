import { z } from 'zod'

/**
 * Query schema for `GET /api/search` (BE-10 / issue #20).
 *
 * `q` is required (min length 1). Pagination is cursor-based to match the
 * contract; `limit` caps at 50 per the issue.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Query "q" is required'),
  category: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})

export type SearchQuery = z.infer<typeof searchQuerySchema>

/** Query schema for the optional autocomplete endpoint. */
export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1, 'Query "q" is required'),
  limit: z.coerce.number().int().min(1).max(20).default(8)
})

export type SuggestQuery = z.infer<typeof suggestQuerySchema>

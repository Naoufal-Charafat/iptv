import { z } from 'zod'

/**
 * Query schema for the stream proxy (BE-12 / issue #22).
 *
 * `url` is the (URL-encoded) upstream stream URL. `ua`/`referrer` are optional
 * passthrough headers carried from the stream metadata.
 */
export const proxyQuerySchema = z.object({
  url: z.string().url('A valid http(s) url is required'),
  ua: z.string().optional(),
  referrer: z.string().optional()
})

export type ProxyQuery = z.infer<typeof proxyQuerySchema>

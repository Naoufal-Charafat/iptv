import { z } from 'zod'

/**
 * Schemas for the stream availability endpoints (BE-14 / issue #24).
 */

export const streamStatusQuerySchema = z.object({
  url: z.string().url('A valid http(s) url is required')
})

export type StreamStatusQuery = z.infer<typeof streamStatusQuerySchema>

export const streamStatusBatchBodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50)
})

export type StreamStatusBatchBody = z.infer<typeof streamStatusBatchBodySchema>

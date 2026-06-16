import type { FastifyInstance } from 'fastify'
import { healthRoutes } from './health.js'
import { channelsRoutes } from './channels.js'
import { dimensionsRoutes } from './dimensions.js'
import { searchRoutes } from './search.js'
import { favoritesRoutes } from './favorites.js'
import { proxyRoutes } from './proxy.js'
import { streamStatusRoutes } from './stream-status.js'

/**
 * Central route registration (BE-01 / issue #11).
 *
 * Health endpoints plus the domain routes:
 *   - channels list/detail/streams/epg (BE-08, BE-11 / issues #18, #21)
 *   - dimension catalogues             (BE-09 / issue #19)
 *   - full-text search                 (BE-10 / issue #20)
 *   - stream CORS proxy                (BE-12 / issue #22)
 *   - favorites                        (BE-13 / issue #23)
 *   - stream availability              (BE-14 / issue #24)
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes)
  await app.register(channelsRoutes)
  await app.register(dimensionsRoutes)
  await app.register(searchRoutes)
  await app.register(favoritesRoutes)
  await app.register(proxyRoutes)
  await app.register(streamStatusRoutes)
}

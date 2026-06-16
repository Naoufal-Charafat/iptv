import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import Fastify, { type FastifyInstance } from 'fastify'
import { config } from './config/env.js'
import { registerErrorHandlers } from './lib/errors.js'
import { buildLoggerOptions } from './lib/logger.js'
import { registerRoutes } from './routes/index.js'

/**
 * Application factory (BE-01 / issue #11).
 *
 * Builds and configures a Fastify instance but does NOT call `listen`, so tests
 * can drive it via `app.inject()` and `server.ts` owns the network lifecycle.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: buildLoggerOptions(),
    // Trust the incoming request id header if present, otherwise generate one.
    genReqId: req => {
      const header = req.headers['x-request-id']
      if (typeof header === 'string' && header.length > 0) return header
      return randomUUID()
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId'
  })

  // CORS: allow the Vite frontend origin (configurable).
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true
  })

  // @fastify/sensible: httpErrors, assertions and useful reply helpers.
  await app.register(sensible)

  // Echo the resolved request id back to the client for traceability.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })

  // Consistent JSON error + 404 handling aligned with the ApiError contract.
  registerErrorHandlers(app)

  // Application routes (health + future domain routes).
  await registerRoutes(app)

  return app
}

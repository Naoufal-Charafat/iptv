import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { ZodError } from 'zod'
import { config } from '../config/env.js'
import type { ApiError } from '../types/contract.js'

/**
 * Application error with an explicit HTTP status and machine-readable code.
 * Routes/services throw this for expected failures; the global handler maps it
 * to the `ApiError` envelope (BE-03 / issue #13).
 */
export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

/** Convenience factories for common error cases. */
export const errors = {
  notFound: (message = 'Resource not found', details?: unknown) =>
    new AppError(404, 'NOT_FOUND', message, details),
  badRequest: (message = 'Bad request', details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),
  serviceUnavailable: (message = 'Service unavailable', details?: unknown) =>
    new AppError(503, 'SERVICE_UNAVAILABLE', message, details),
  internal: (message = 'Internal server error', details?: unknown) =>
    new AppError(500, 'INTERNAL_ERROR', message, details)
} as const

/** Convert an HTTP status code into a default machine-readable code. */
function codeFromStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 422:
      return 'UNPROCESSABLE_ENTITY'
    case 429:
      return 'TOO_MANY_REQUESTS'
    case 503:
      return 'SERVICE_UNAVAILABLE'
    default:
      return statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR'
  }
}

interface NormalizedError {
  statusCode: number
  body: ApiError
}

/** Build a flat `ApiError` body (matches the frontend `@client-iptv/shared`). */
function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
): ApiError {
  const body: ApiError = { code, message, status }
  if (details !== undefined && details !== null) {
    body.details = (
      typeof details === 'object' && !Array.isArray(details)
        ? (details as Record<string, unknown>)
        : { details }
    ) as Record<string, unknown>
  }
  return body
}

/** Map any thrown value to a status code and flat `ApiError` body. */
function normalizeError(error: unknown): NormalizedError {
  // Our own application errors.
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: apiError(error.statusCode, error.code, error.message, error.details)
    }
  }

  // Zod validation errors (e.g. from manual schema parsing in a handler).
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: apiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
        issues: error.issues
      })
    }
  }

  // Fastify errors (validation, @fastify/sensible httpErrors, etc.).
  const fastifyError = error as Partial<FastifyError> & { statusCode?: number }
  if (fastifyError && typeof fastifyError.statusCode === 'number') {
    const statusCode = fastifyError.statusCode
    return {
      statusCode,
      body: apiError(
        statusCode,
        fastifyError.code ?? codeFromStatus(statusCode),
        fastifyError.message ?? 'Request failed',
        fastifyError.validation ? { issues: fastifyError.validation } : undefined
      )
    }
  }

  // Unknown / unexpected error -> opaque 500.
  return {
    statusCode: 500,
    body: apiError(500, 'INTERNAL_ERROR', 'Internal server error')
  }
}

/**
 * Register the global error and not-found handlers on a Fastify instance.
 * Produces consistent `{ error: { code, message, details? } }` JSON bodies and
 * hides internal details/stacks in production.
 */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const { statusCode, body } = normalizeError(error)

    // Log 5xx as errors, 4xx as warnings.
    if (statusCode >= 500) {
      request.log.error({ err: error, reqId: request.id }, 'request failed')
    } else {
      request.log.warn({ err: error, reqId: request.id }, 'request rejected')
    }

    // In production, never leak internal details for 5xx responses.
    if (config.isProd && statusCode >= 500) {
      reply
        .status(statusCode)
        .send(apiError(statusCode, 'INTERNAL_ERROR', 'Internal server error'))
      return
    }

    reply.status(statusCode).send(body)
  })

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply
      .status(404)
      .send(
        apiError(404, 'NOT_FOUND', `Route ${request.method} ${request.url} not found`)
      )
  })
}

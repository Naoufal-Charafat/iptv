import pino, { type Logger, type LoggerOptions } from 'pino'
import { config } from '../config/env.js'

/**
 * Fastify logger configuration (BE-03 / issue #13).
 *
 * - Level comes from `config.LOG_LEVEL`.
 * - `pino-pretty` is used only in development for readable output; production
 *   and test emit structured JSON (test stays quiet by default).
 * - Fastify already attaches a per-request `reqId`; see `app.ts` for the
 *   request-id propagation hook.
 */
export function buildLoggerOptions(): LoggerOptions | boolean {
  if (config.isTest) {
    // Silence logs during tests unless explicitly raised via LOG_LEVEL.
    return { level: config.LOG_LEVEL === 'info' ? 'silent' : config.LOG_LEVEL }
  }

  const options: LoggerOptions = {
    level: config.LOG_LEVEL
  }

  if (config.isDev) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname'
      }
    }
  }

  return options
}

/**
 * Standalone pino logger for non-HTTP contexts (CLI scripts: migrations, ETL,
 * seed). Reuses the same options as the Fastify logger. In tests it stays at
 * the configured (silent) level so the suite output stays clean.
 */
export const logger: Logger = (() => {
  const options = buildLoggerOptions()
  if (options === true) return pino()
  if (options === false) return pino({ level: 'silent' })
  return pino(options)
})()

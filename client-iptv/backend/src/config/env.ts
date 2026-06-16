import { z } from 'zod'

/**
 * Environment configuration for the backend.
 *
 * Reads `process.env`, validates it with Zod and exports a typed, immutable
 * `config` object. Invalid configuration aborts the process at startup with a
 * readable message naming the offending variable (BE-02 / issue #12).
 */

const NodeEnv = z.enum(['development', 'test', 'production'])

const LogLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])

/**
 * Coerce a string env var into an integer with a clear error message.
 * `z.coerce.number()` would accept floats and `NaN` for empty strings, so we
 * validate explicitly.
 */
const port = z
  .string()
  .default('3001')
  .refine(value => /^\d+$/.test(value), {
    message: 'must be an integer (e.g. 3001)'
  })
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535))

const envSchema = z.object({
  NODE_ENV: NodeEnv.default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: port,
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  /**
   * Path to the SQLite database file. `DATABASE_PATH` is the canonical name;
   * `DB_PATH` is accepted as an alias and resolved in `loadConfig`.
   */
  DATABASE_PATH: z.string().min(1).default('./data/iptv.db'),
  /** Directory holding the raw iptv-org JSON snapshots used by the ETL. */
  DATA_DIR: z.string().min(1).default('./data/raw'),
  IPTV_API_BASE_URL: z.string().url().default('https://iptv-org.github.io/api'),
  LOG_LEVEL: LogLevel.default('info')
})

export type Config = Readonly<z.infer<typeof envSchema>> & {
  readonly isDev: boolean
  readonly isProd: boolean
  readonly isTest: boolean
}

/**
 * Parse and validate `process.env`. On failure, prints each invalid variable
 * and exits with code 1 instead of throwing an opaque stack trace.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  // `DB_PATH` is accepted as an alias for `DATABASE_PATH`.
  const merged: NodeJS.ProcessEnv = {
    ...source,
    DATABASE_PATH: source.DATABASE_PATH ?? source.DB_PATH
  }

  const result = envSchema.safeParse(merged)

  if (!result.success) {
    const issues = result.error.issues
      .map(issue => {
        const key = issue.path.join('.') || '(root)'
        return `  - ${key}: ${issue.message}`
      })
      .join('\n')

    console.error(`Invalid environment configuration:\n${issues}`)
    process.exit(1)
  }

  const parsed = result.data

  return Object.freeze({
    ...parsed,
    isDev: parsed.NODE_ENV === 'development',
    isProd: parsed.NODE_ENV === 'production',
    isTest: parsed.NODE_ENV === 'test'
  })
}

/** Validated, immutable configuration shared across the app. */
export const config: Config = loadConfig()

/**
 * Backend HTTP health/error contract types.
 *
 * The canonical API contract lives in the `@client-iptv/shared` workspace
 * package (FND-01 / issue #5); `ApiError` is re-exported from there so the
 * error envelope is defined exactly once. The Health* responses below are
 * backend-internal (not consumed by the frontend) and stay local.
 */

/** Canonical error envelope: `{ code, message, status, details? }`. */
export type { ApiError } from '@client-iptv/shared'

/** Response shape for `GET /api/health`. */
export interface HealthResponse {
  status: 'ok'
  /** Process uptime in seconds. */
  uptime: number
  /** Backend package version. */
  version: string
  /** ISO-8601 timestamp of the response. */
  timestamp: string
}

/** Response shape for `GET /api/health/db`. */
export interface DbHealthResponse {
  status: 'ok' | 'error'
  /** Number of rows in the `channels` table, when available. */
  channelsCount?: number
  /** Error message when the database is unavailable. */
  message?: string
}

import type { ApiError } from '@client-iptv/shared'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** Type guard for the normalized {@link ApiError} shape. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'status' in value
  )
}

export class ApiRequestError extends Error implements ApiError {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.code = error.code
    this.status = error.status
    this.details = error.details
  }
}

type QueryValue = string | number | boolean | undefined | null

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Query string params; undefined/null/empty values are dropped. */
  params?: Record<string, QueryValue>
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(
    `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
    // Fallback base lets URL parse relative paths in the browser.
    BASE_URL || window.location.origin
  )
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, headers, ...rest } = options

  const response = await fetch(buildUrl(path, params), {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      // Non-JSON error body; fall through to a synthesized error.
    }
    if (isApiError(payload)) {
      throw new ApiRequestError(payload)
    }
    throw new ApiRequestError({
      code: 'HTTP_ERROR',
      message: response.statusText || 'Request failed',
      status: response.status
    })
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST' })
}
